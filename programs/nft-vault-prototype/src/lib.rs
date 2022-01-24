use anchor_lang::prelude::*;
use anchor_lang::solana_program::program::{invoke, invoke_signed};
use anchor_lang::solana_program::system_instruction;
use anchor_spl::token::{Mint, TokenAccount};

declare_id!("5GL4DTAqK5j4MFWkdrf51TGGvcFePMuLrDSpnAvfNgqT");

#[program]
pub mod nft_vault_prototype {

    use super::*;
    // TODO: pass in all relevant accounts to be initialized by the program
    pub fn initialize_collection(
        _ctx: Context<InitializeCollection>,
        artist_mint_percentage: u64,
        label_mint_percentage: u64,
        artist_secondary_percentage: u64,
        label_secondary_percentage: u64,
        // artist_splits: Vec<ArtistPercentage>,
        single_artist: Pubkey,
    ) -> ProgramResult {
        let one_hundred_percent = 10000;

        // Verify label splits add up to 100%
        if artist_mint_percentage + label_mint_percentage != one_hundred_percent
            || artist_secondary_percentage + label_secondary_percentage != one_hundred_percent
        {
            return Err(ErrorCode::InvalidCollectionConfig.into());
        }

        // TODO: verify artist_splits add to 100%

        // Set collection authority
        _ctx.accounts.collection_config.collection_authority = _ctx.accounts.payer.key();

        // Set percentage splits used on mint
        _ctx.accounts.collection_config.artist_mint_percentage = artist_mint_percentage;
        _ctx.accounts.collection_config.label_mint_percentage = label_mint_percentage;

        // Set percentage splits used on resales and licensing
        _ctx.accounts.collection_config.artist_secondary_percentage = artist_secondary_percentage;
        _ctx.accounts.collection_config.label_secondary_percentage = label_secondary_percentage;

        let artist_split = ArtistPercentage {
            artist_address: single_artist,
            allocated_percentage: 10000,
        };

        // TODO: figure out how to pass in artist splits and change this
        _ctx.accounts
            .collection_config
            .artist_splits
            .push(artist_split);

        _ctx.accounts
            .artist_balance_ledger
            .initialize_artist_ledger(_ctx.accounts.collection_config.artist_splits.clone())?;

        Ok(())
    }

    pub fn member_withdraw(ctx: Context<MemberWithdraw>) -> ProgramResult {
        // TODO: add authority check.

        // Derive balance ledger PDA address
        let nft_ledger_pda = Pubkey::create_program_address(&[b"nft-ledger", &[255]], &id())?;

        if nft_ledger_pda != ctx.accounts.nft_balance_ledger.key() {
            return Err(ErrorCode::InvalidBalanceLedger.into());
        }

        // Check associated account is of correct mint type
        let nft_associated_account_mint = ctx.accounts.nft_associated_account.mint;
        let actual_nft_mint = ctx.accounts.nft.key();
        if nft_associated_account_mint != actual_nft_mint {
            return Err(ErrorCode::InvalidNftAssociatedAccount.into());
        }

        // Check associated account balance is not 0
        if ctx.accounts.nft_associated_account.amount == 0 {
            return Err(ErrorCode::AssociatedAccountBalanceZero.into());
        }

        // Check associated account is owned by withdrawer
        let nft_associated_account_owner = ctx.accounts.nft_associated_account.owner;

        if ctx.accounts.to.key() != nft_associated_account_owner {
            return Err(ErrorCode::NftNotOwnedByWithdrawer.into());
        }

        // Empty royalties_balance in ledger for given NFT
        // Errors out if NFT is not found in ledger
        let amount = ctx
            .accounts
            .nft_balance_ledger
            .empty_royalties_balance_for_nft(ctx.accounts.nft.key())?;

        let ix = system_instruction::transfer(
            &ctx.accounts.pda_vault.key(),
            &ctx.accounts.to.key,
            amount,
        );

        // Withdraw
        invoke_signed(
            &ix,
            &[
                ctx.accounts.system_program.to_account_info(),
                ctx.accounts.pda_vault.to_account_info(),
                ctx.accounts.to.to_account_info(),
            ],
            &[&[b"vault", &[255]]],
        )?;
        Ok(())
    }

    pub fn artist_withdraw(ctx: Context<ArtistWithdraw>) -> ProgramResult {
        // TODO: add authority check.

        // TODO: check PDA Vault

        let artist_ledger_pda = Pubkey::create_program_address(&[b"artist-ledger", &[255]], &id())?;

        if artist_ledger_pda != ctx.accounts.artist_balance_ledger.key() {
            return Err(ErrorCode::InvalidBalanceLedger.into());
        }

        // Empty royalties_balance in ledger for given NFT
        // Errors out if NFT is not found in ledger
        let amount = ctx
            .accounts
            .artist_balance_ledger
            .empty_royalties_balance_for_artist(ctx.accounts.artist_account.key())?;

        let ix = system_instruction::transfer(
            &ctx.accounts.pda_vault.key(),
            &ctx.accounts.artist_account.key,
            amount,
        );

        // Withdraw
        invoke_signed(
            &ix,
            &[
                ctx.accounts.system_program.to_account_info(),
                ctx.accounts.pda_vault.to_account_info(),
                ctx.accounts.artist_account.to_account_info(),
            ],
            &[&[b"vault", &[255]]],
        )?;

        Ok(())
    }

    /**
     * Secondary pool usually used for holding resale earnings
     * Must be distributed to ledger and transferred to vault
     */
    pub fn distribute_secondary_pool(ctx: Context<DistributeSecondaryPool>) -> ProgramResult {
        Ok(())
    }

    pub fn pay_licensing_fee(ctx: Context<PayLicensingFee>) -> ProgramResult {
        Ok(())
    }

    pub fn pay_label(ctx: Context<PayLabel>, amount: u64) -> ProgramResult {
        // Distribute payment to royalties balances for all minted NFTs
        ctx.accounts
            .nft_balance_ledger
            .distribute_payments(amount)?;

        // Send sol to pda vault account
        let ix = system_instruction::transfer(
            &ctx.accounts.from.key,
            &ctx.accounts.pda_vault.key,
            amount,
        );

        invoke(
            &ix,
            &[
                ctx.accounts.system_program.to_account_info(),
                ctx.accounts.pda_vault.to_account_info(),
                ctx.accounts.from.to_account_info(),
            ],
        )?;

        Ok(())
    }

    pub fn add_nft(ctx: Context<AddNft>, amount_paid: u64) -> ProgramResult {
        let one_hundred_percent = 10000;

        // TODO: CollectionAuthority signed
        if ctx.accounts.collection_config.collection_authority
            != ctx.accounts.collection_authority.key()
        {
            return Err(ErrorCode::MissingCollectionAuthoritySignature.into());
        }

        // TODO: check pda accounts are as expected

        // TODO: verify if collection splits add up to 100%

        // TODO: verify if NFT is already part of collection

        // On first mint, label size is 0, so all revenue goes to artist
        if ctx.accounts.nft_balance_ledger.size == 0 {
            // update the artist ledger with royalties
            ctx.accounts
                .artist_balance_ledger
                .distribute_artist_payments(
                    amount_paid,
                    ctx.accounts.collection_config.artist_splits.clone(),
                )?;
        } else {
            let amount_to_artist = amount_paid
                * ctx.accounts.collection_config.artist_mint_percentage
                / one_hundred_percent;

            // update the artist ledger with royalties
            ctx.accounts
                .artist_balance_ledger
                .distribute_artist_payments(
                    amount_to_artist,
                    ctx.accounts.collection_config.artist_splits.clone(),
                )?;

            let amount_to_label = amount_paid
                * ctx.accounts.collection_config.label_mint_percentage
                / one_hundred_percent;

            // update the label nft balance ledger with royalties
            ctx.accounts
                .nft_balance_ledger
                .distribute_payments(amount_to_label)?;
        }

        // Add nft address to ledger
        ctx.accounts
            .nft_balance_ledger
            .add_nft_to_ledger(ctx.accounts.nft_address.key());

        Ok(())
    }
}

// TODO: can the vault just be combined in balance ledger?
#[derive(Accounts)]
pub struct InitializeCollection<'info> {
    // TODO: calculate proper spacing and stress test max space
    #[account(init, payer = payer, space = 9000, seeds = [b"collection-config"], bump = 254)]
    collection_config: Account<'info, CollectionConfiguration>,
    #[account(init, payer = payer, space = 9000, seeds = [b"nft-ledger"], bump = 255)]
    nft_balance_ledger: Account<'info, NftBalanceLedger>,
    // All PDAs are verified implicitly by macros
    #[account(init, payer = payer, space = 500, seeds = [b"artist-ledger"], bump = 255)]
    artist_balance_ledger: Account<'info, ArtistBalanceLedger>,
    #[account(mut)]
    payer: Signer<'info>,
    system_program: Program<'info, System>,
}

// TODO: when and where should we use UncheckedAccount
#[derive(Accounts)]
pub struct MemberWithdraw<'info> {
    #[account(mut)]
    to: SystemAccount<'info>,
    #[account(mut)]
    pda_vault: SystemAccount<'info>,
    nft: Account<'info, Mint>,
    nft_associated_account: Account<'info, TokenAccount>,
    #[account(mut)]
    nft_balance_ledger: Account<'info, NftBalanceLedger>,
    system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ArtistWithdraw<'info> {
    #[account(mut)]
    artist_account: SystemAccount<'info>,
    #[account(mut)]
    pda_vault: SystemAccount<'info>,
    #[account(mut)]
    artist_balance_ledger: Account<'info, ArtistBalanceLedger>,
    system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DistributeSecondaryPool<'info> {
    #[account(mut)]
    from: Signer<'info>,
    #[account(mut)]
    pda_vault: SystemAccount<'info>,
    #[account(mut)]
    nft_balance_ledger: Account<'info, NftBalanceLedger>,
    system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct PayLicensingFee<'info> {
    #[account(mut)]
    from: Signer<'info>,
    #[account(mut)]
    pda_vault: SystemAccount<'info>,
    #[account(mut)]
    nft_balance_ledger: Account<'info, NftBalanceLedger>,
    system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct PayLabel<'info> {
    #[account(mut)]
    from: Signer<'info>,
    #[account(mut)]
    pda_vault: SystemAccount<'info>,
    #[account(mut)]
    nft_balance_ledger: Account<'info, NftBalanceLedger>,
    system_program: Program<'info, System>,
}

// TODO: see if payer and authority need to be mut
#[derive(Accounts)]
pub struct AddNft<'info> {
    #[account(mut)]
    payer: Signer<'info>,
    #[account(mut)]
    collection_authority: Signer<'info>,
    collection_config: Account<'info, CollectionConfiguration>,
    #[account(mut)]
    artist_balance_ledger: Account<'info, ArtistBalanceLedger>,
    #[account(mut)]
    nft_balance_ledger: Account<'info, NftBalanceLedger>,
    nft_address: Account<'info, Mint>,
    system_program: Program<'info, System>,
}

/**
 * Details of Collection, set on init
 *
 * percentages are in basis points
 * 3000 = 30%, 500 = 5%, divide by 10,000
 */
#[account]
pub struct CollectionConfiguration {
    pub collection_authority: Pubkey,
    pub artist_mint_percentage: u64, // mint % is only used for mint splits
    pub label_mint_percentage: u64,
    pub artist_secondary_percentage: u64, // secondary % is used for licensing and resale splits
    pub label_secondary_percentage: u64,
    pub artist_splits: Vec<ArtistPercentage>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct ArtistPercentage {
    pub artist_address: Pubkey,
    pub allocated_percentage: u64, // 3000 = 30%, 500 = 5%, divide by 10,000
}

#[account]
pub struct ArtistBalanceLedger {
    pub artist_balances: Vec<ArtistBalance>,
    pub size: u64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct ArtistBalance {
    pub artist_address: Pubkey,
    pub royalties_balance: u64,
}

impl ArtistBalanceLedger {
    fn initialize_artist_ledger(&mut self, artist_splits: Vec<ArtistPercentage>) -> Result<()> {
        for artist_split in artist_splits.iter() {
            let init_artist_balance = ArtistBalance {
                artist_address: artist_split.artist_address,
                royalties_balance: 0,
            };
            self.artist_balances.push(init_artist_balance);
            self.size += 1;
        }

        // TODO: verify splits add up to 100%

        Ok(())
    }

    fn distribute_artist_payments(
        &mut self,
        amount: u64,
        artist_splits: Vec<ArtistPercentage>,
    ) -> Result<()> {
        if self.size == 0 {
            return Err(ErrorCode::ArtistLedgerNotInitialized.into());
        }

        let one_hundred_percent = 10000;

        // TODO: check for valid artist_splits adds up to 100%

        // Iterate through balance ledger and splits to distrubte proper amounts
        for artist_balance in self.artist_balances.iter_mut() {
            for artist_split in artist_splits.iter() {
                if artist_split.artist_address == artist_balance.artist_address {
                    // Todo: Ensure rounding doesn't introduce vulnerability
                    let amount_to_distribute =
                        amount * artist_split.allocated_percentage / one_hundred_percent;
                    artist_balance.royalties_balance += amount_to_distribute;
                }
            }
        }

        Ok(())
    }

    fn empty_royalties_balance_for_artist(&mut self, artist_address: Pubkey) -> Result<u64> {
        for artist_balance in self.artist_balances.iter_mut() {
            if artist_balance.artist_address == artist_address {
                let owed_balance = artist_balance.royalties_balance.clone();
                artist_balance.royalties_balance = 0;
                return Ok(owed_balance);
            }
        }

        Err(ErrorCode::InvalidArtist.into())
    }
}

#[account]
pub struct NftBalanceLedger {
    pub nft_balances: Vec<NftBalance>,
    pub size: u64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct NftBalance {
    pub nft_address: Pubkey,
    pub royalties_balance: u64,
}

impl NftBalanceLedger {
    fn distribute_payments(&mut self, amount: u64) -> Result<()> {
        if self.size == 0 {
            return Err(ErrorCode::InvalidRoyaltiesDistribution.into());
        }

        // Todo: Ensure rounding doesn't introduce vulnerability
        let amount_to_distribute = amount / self.size;

        for nft_balance in self.nft_balances.iter_mut() {
            nft_balance.royalties_balance += amount_to_distribute;
        }

        Ok(())
    }
    fn add_nft_to_ledger(&mut self, nft_address: Pubkey) {
        let nft_balance = NftBalance {
            nft_address: nft_address,
            royalties_balance: 0,
        };

        self.nft_balances.push(nft_balance);
        self.size += 1;
    }

    fn empty_royalties_balance_for_nft(&mut self, nft_address: Pubkey) -> Result<u64> {
        for nft_balance in self.nft_balances.iter_mut() {
            if nft_balance.nft_address == nft_address {
                let owed_balance = nft_balance.royalties_balance.clone();
                nft_balance.royalties_balance = 0;
                return Ok(owed_balance);
            }
        }

        Err(ErrorCode::InvalidNft.into())
    }
}

#[error]
pub enum ErrorCode {
    #[msg("Error: NFT address not found in ledger")]
    InvalidNft,
    #[msg("Error: Artist address not found in ledger")]
    InvalidArtist,
    #[msg("Error: Invalid Balance Ledger Address")]
    InvalidBalanceLedger,
    #[msg("Error: Withdrawer is not the NFT owner")]
    InvalidWithdrawer,
    #[msg("Error: Unable to distribute royalties as no NFTs have been minted")]
    InvalidRoyaltiesDistribution,
    #[msg("Error: Incorrect associated account for nft")]
    InvalidNftAssociatedAccount,
    #[msg("Error: Associated account has a balance of zero")]
    AssociatedAccountBalanceZero,
    #[msg("Error: NFT is not owned by withdrawer")]
    NftNotOwnedByWithdrawer,
    #[msg("Error: Invalid Collection Config parameters")]
    InvalidCollectionConfig,
    #[msg("Error: Missing Collection Authority Signature")]
    MissingCollectionAuthoritySignature,
    #[msg("Error: Artist Ledger not initialized")]
    ArtistLedgerNotInitialized,
}
