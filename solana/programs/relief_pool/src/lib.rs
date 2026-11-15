//! EvacuAid relief pool.
//!
//! Donors fund a pool for one incident. The money can only leave when:
//!   1. the county has published an evacuation order for that zone (on-chain),
//!   2. the household stays within the per-household cap ($770, FEMA's amount),
//!   3. it goes to the county's relief account, fixed when the pool was created.
//! Every release names the household (as a hash, never a name) and the Nessie
//! transaction that paid the family, so anyone can audit the whole path.
//!
//! What this program does not do: decide who needs help. That is checked off-chain
//! against bank data (Capital One Nessie) before the county asks for a release.

use anchor_lang::prelude::*;
use anchor_spl::token_interface::{self, Mint, TokenAccount, TokenInterface, TransferChecked};

declare_id!("HZYxz8EF9iqNERbZucuTygzGVHNc9xfrw1YtwEqYBV3");

#[program]
pub mod relief_pool {
    use super::*;

    /// The county opens a pool for an incident and names where released money may go.
    pub fn init_pool(ctx: Context<InitPool>, incident: String, cap_per_household: u64) -> Result<()> {
        require!(incident.len() <= 32, PoolError::NameTooLong);
        require!(cap_per_household > 0, PoolError::BadAmount);
        let pool = &mut ctx.accounts.pool;
        pool.authority = ctx.accounts.authority.key();
        pool.mint = ctx.accounts.mint.key();
        pool.vault = ctx.accounts.vault.key();
        pool.county_payout = ctx.accounts.county_payout.key();
        pool.cap_per_household = cap_per_household;
        pool.incident = incident;
        pool.total_donated = 0;
        pool.total_released = 0;
        pool.releases = 0;
        pool.bump = ctx.bumps.pool;
        Ok(())
    }

    /// Anyone can give. The gift is public and can only leave under the pool's rules.
    pub fn donate(ctx: Context<Donate>, amount: u64) -> Result<()> {
        require!(amount > 0, PoolError::BadAmount);
        token_interface::transfer_checked(
            CpiContext::new(
                ctx.accounts.token_program.key(),
                TransferChecked {
                    from: ctx.accounts.donor_tokens.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                    authority: ctx.accounts.donor.to_account_info(),
                },
            ),
            amount,
            ctx.accounts.mint.decimals,
        )?;
        let pool = &mut ctx.accounts.pool;
        pool.total_donated = pool.total_donated.checked_add(amount).ok_or(PoolError::Overflow)?;
        emit!(Donated { pool: pool.key(), donor: ctx.accounts.donor.key(), amount });
        Ok(())
    }

    /// The county posts an evacuation order for a zone. This is what unlocks the zone's money.
    pub fn publish_order(ctx: Context<PublishOrder>, zone: String) -> Result<()> {
        require!(zone.len() <= 32, PoolError::NameTooLong);
        let z = &mut ctx.accounts.zone_account;
        z.pool = ctx.accounts.pool.key();
        z.name = zone.clone();
        z.ordered_at = Clock::get()?.unix_timestamp;
        z.bump = ctx.bumps.zone_account;
        emit!(OrderPublished { pool: z.pool, zone, at: z.ordered_at });
        Ok(())
    }

    /// Release money for one household in an ordered zone, to the county's relief account.
    pub fn release(ctx: Context<Release>, household: [u8; 32], zone: String, amount: u64, nessie_tx: String) -> Result<()> {
        require!(amount > 0, PoolError::BadAmount);
        require!(nessie_tx.len() <= 64, PoolError::NameTooLong);
        require!(ctx.accounts.zone_account.name == zone, PoolError::ZoneNotOrdered);

        let pool = &ctx.accounts.pool;
        let claim = &mut ctx.accounts.claim;
        if claim.pool == Pubkey::default() {
            claim.pool = pool.key();
            claim.household = household;
            claim.bump = ctx.bumps.claim;
        }
        let after = claim.total.checked_add(amount).ok_or(PoolError::Overflow)?;
        require!(after <= pool.cap_per_household, PoolError::OverHouseholdCap);

        let incident = pool.incident.clone();
        let seeds: &[&[u8]] = &[b"pool", pool.authority.as_ref(), incident.as_bytes(), &[pool.bump]];
        token_interface::transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.key(),
                TransferChecked {
                    from: ctx.accounts.vault.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.county_payout.to_account_info(),
                    authority: ctx.accounts.pool.to_account_info(),
                },
                &[seeds],
            ),
            amount,
            ctx.accounts.mint.decimals,
        )?;

        claim.total = after;
        let pool = &mut ctx.accounts.pool;
        pool.total_released = pool.total_released.checked_add(amount).ok_or(PoolError::Overflow)?;
        pool.releases = pool.releases.checked_add(1).ok_or(PoolError::Overflow)?;
        emit!(Released { pool: pool.key(), household, zone, amount, household_total: after, nessie_tx });
        Ok(())
    }
}

// ---------- accounts ----------

#[account]
#[derive(InitSpace)]
pub struct Pool {
    pub authority: Pubkey,
    pub mint: Pubkey,
    pub vault: Pubkey,
    pub county_payout: Pubkey,
    pub cap_per_household: u64,
    pub total_donated: u64,
    pub total_released: u64,
    pub releases: u64,
    #[max_len(32)]
    pub incident: String,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Zone {
    pub pool: Pubkey,
    #[max_len(32)]
    pub name: String,
    pub ordered_at: i64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Claim {
    pub pool: Pubkey,
    pub household: [u8; 32],
    pub total: u64,
    pub bump: u8,
}

#[derive(Accounts)]
#[instruction(incident: String)]
pub struct InitPool<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        init,
        payer = authority,
        space = 8 + Pool::INIT_SPACE,
        seeds = [b"pool", authority.key().as_ref(), incident.as_bytes()],
        bump
    )]
    pub pool: Account<'info, Pool>,
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(
        init,
        payer = authority,
        token::mint = mint,
        token::authority = pool,
        token::token_program = token_program,
        seeds = [b"vault", pool.key().as_ref()],
        bump
    )]
    pub vault: InterfaceAccount<'info, TokenAccount>,
    /// The county's relief account: the only place released money can go.
    #[account(token::mint = mint, token::token_program = token_program)]
    pub county_payout: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Donate<'info> {
    #[account(mut)]
    pub donor: Signer<'info>,
    #[account(mut, has_one = mint, has_one = vault)]
    pub pool: Account<'info, Pool>,
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(mut, token::mint = mint, token::authority = donor, token::token_program = token_program)]
    pub donor_tokens: InterfaceAccount<'info, TokenAccount>,
    #[account(mut)]
    pub vault: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Interface<'info, TokenInterface>,
}

#[derive(Accounts)]
#[instruction(zone: String)]
pub struct PublishOrder<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(has_one = authority @ PoolError::NotCounty)]
    pub pool: Account<'info, Pool>,
    #[account(
        init,
        payer = authority,
        space = 8 + Zone::INIT_SPACE,
        seeds = [b"zone", pool.key().as_ref(), zone.as_bytes()],
        bump
    )]
    pub zone_account: Account<'info, Zone>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(household: [u8; 32], zone: String)]
pub struct Release<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        mut,
        has_one = authority @ PoolError::NotCounty,
        has_one = mint,
        has_one = vault,
        has_one = county_payout @ PoolError::WrongPayout
    )]
    pub pool: Account<'info, Pool>,
    /// Exists only if the county published an order for this zone.
    #[account(
        seeds = [b"zone", pool.key().as_ref(), zone.as_bytes()],
        bump = zone_account.bump,
        constraint = zone_account.pool == pool.key() @ PoolError::ZoneNotOrdered
    )]
    pub zone_account: Account<'info, Zone>,
    #[account(
        init_if_needed,
        payer = authority,
        space = 8 + Claim::INIT_SPACE,
        seeds = [b"claim", pool.key().as_ref(), household.as_ref()],
        bump
    )]
    pub claim: Account<'info, Claim>,
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(mut)]
    pub vault: InterfaceAccount<'info, TokenAccount>,
    #[account(mut)]
    pub county_payout: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

// ---------- events ----------

#[event]
pub struct Donated {
    pub pool: Pubkey,
    pub donor: Pubkey,
    pub amount: u64,
}

#[event]
pub struct OrderPublished {
    pub pool: Pubkey,
    pub zone: String,
    pub at: i64,
}

#[event]
pub struct Released {
    pub pool: Pubkey,
    pub household: [u8; 32],
    pub zone: String,
    pub amount: u64,
    pub household_total: u64,
    pub nessie_tx: String,
}

// ---------- errors ----------

#[error_code]
pub enum PoolError {
    #[msg("No evacuation order has been published for this zone")]
    ZoneNotOrdered,
    #[msg("This would take the household past its cap")]
    OverHouseholdCap,
    #[msg("Money can only go to the county's relief account")]
    WrongPayout,
    #[msg("Only the county can do this")]
    NotCounty,
    #[msg("Amount must be greater than zero")]
    BadAmount,
    #[msg("Name is too long")]
    NameTooLong,
    #[msg("Number overflow")]
    Overflow,
}
