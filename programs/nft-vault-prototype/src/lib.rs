use anchor_lang::prelude::*;
use anchor_lang::solana_program::system_instruction;
use anchor_lang::solana_program::program::{invoke_signed, invoke};
use anchor_spl::token::{Mint, TokenAccount};

declare_id!("5GL4DTAqK5j4MFWkdrf51TGGvcFePMuLrDSpnAvfNgqT");

#[program]
pub mod nft_vault_prototype {

    use super::*;
    pub fn initialize_balance_ledger(_ctx: Context<InitializeBalanceLedger>) -> ProgramResult {
        Ok(())
    }

    pub fn withdraw(ctx: Context<Withdraw>) -> ProgramResult {
        
        // Derive balance ledger PDA address
        let balance_ledger_pda = Pubkey::create_program_address(&[b"balance-ledger", &[254]], &id())?;

        if balance_ledger_pda != ctx.accounts.nft_balance_ledger.key() {
            return Err(ErrorCode::InvalidBalanceLedger.into())
        }

        // TODO: ensure owner is NFT owner - https://solanacookbook.com/references/nfts.html#get-the-owner-of-an-nft
        
        //utils::assert_owned_by(&ctx.accounts.nft.to_account_info(), &ctx.accounts.to.key())?;

        let nft_associated_account_mint = ctx.accounts.nft_associated_account.mint;
        let actual_nft_mint = ctx.accounts.nft.key();

        // Check associated account is of correct mint type
        if nft_associated_account_mint !=  actual_nft_mint {
            return Err(ErrorCode::InvalidNftAssociatedAccount.into())
        }

        // Check associated account balance is not 0
        if ctx.accounts.nft_associated_account.amount == 0 {
            return Err(ErrorCode::AssociatedAccountBalanceZero.into())
        }

        // Check associated account is owned by withdrawer
        let nft_associated_account_owner = ctx.accounts.nft_associated_account.owner;

        if ctx.accounts.to.key() != nft_associated_account_owner {
            return Err(ErrorCode::NftNotOwnedByWithdrawer.into())
        }




        // Empty royalties_balance in ledger for given NFT
        // Errors out if NFT is not found in ledger

        let amount = ctx.accounts.nft_balance_ledger.empty_royalties_balance_for_nft(ctx.accounts.nft.key())?;


        let ix = system_instruction::transfer(&ctx.accounts.pda_vault.key(), &ctx.accounts.to.key, amount);

        // Withdraw
        invoke_signed(
            &ix, 
            &[ctx.accounts.system_program.to_account_info(), ctx.accounts.pda_vault.to_account_info(), ctx.accounts.to.to_account_info()],
            &[&[b"vault", &[255]]],
        )?;
        
        Ok(())
    }

    pub fn pay_label(ctx: Context<PayLabel>, amount: u64) -> ProgramResult {

        // Distribute payment to royalties balances for all minted NFTs
        ctx.accounts.nft_balance_ledger.distribute_payments(amount)?;

        // Send sol to pda vault account
        let ix = system_instruction::transfer(&ctx.accounts.from.key, &ctx.accounts.pda_vault.key, amount);

        invoke(
            &ix, 
            &[ctx.accounts.system_program.to_account_info(), ctx.accounts.pda_vault.to_account_info(), ctx.accounts.from.to_account_info()],
        )?;

        Ok(())
    }

    // TODO: modify to prod architecture to mint inside program
    pub fn test_mint_nft(ctx: Context<TestMintNft>, amount: u64) -> ProgramResult {

        //let pda_vault = Pubkey::create_program_address(&[b"balance-ledger", &[254]], &id())?;

        //let pda_vault_info = anchor_lang::solana_program::account_info::AccountInfo {};
        
        // TODO: If label size is 0, all revenue goes to artist
        if ctx.accounts.nft_balance_ledger.size != 0 {
            // Send sol to pda vault account
            let ix = system_instruction::transfer(&ctx.accounts.payer.key, &ctx.accounts.pda_vault.key, amount);

            invoke(
                &ix, 
                &[ctx.accounts.system_program.to_account_info(), ctx.accounts.pda_vault.to_account_info(), ctx.accounts.payer.to_account_info()],
            )?;

            // update the ledger nft balance royalties balance
            ctx.accounts.nft_balance_ledger.distribute_payments(amount)?;
        }

        // Add nft address to ledger
        ctx.accounts.nft_balance_ledger.add_nft_to_ledger(ctx.accounts.nft_address.key());

        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeBalanceLedger<'info> {
    #[account(init, payer = payer, space = 9000, seeds = [b"balance-ledger"], bump = 254)]
    nft_balance_ledger: Account<'info, NftBalanceLedger>,
    #[account(mut)]
    payer: Signer<'info>,
    system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
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
pub struct PayLabel<'info> {
    #[account(mut)]
    from: Signer<'info>,
    #[account(mut)]
    pda_vault: SystemAccount<'info>,
    #[account(mut)]
    nft_balance_ledger: Account<'info, NftBalanceLedger>,
    system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct TestMintNft<'info> {
    #[account(mut)]
    payer: Signer<'info>,
    #[account(mut)]
    pda_vault: SystemAccount<'info>,
    #[account(mut)]
    nft_balance_ledger: Account<'info, NftBalanceLedger>,
    nft_address: Account<'info, Mint>,
    system_program: Program<'info, System>,
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
        if self.size == 0{
            return Err(ErrorCode::InvalidRoyaltiesDistribution.into())
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
            royalties_balance: 0
        };

        self.nft_balances.push(nft_balance);
        self.size += 1;
    }

    fn empty_royalties_balance_for_nft(&mut self, nft_address: Pubkey) -> Result<u64> {
        for nft_balance in self.nft_balances.iter_mut() {
            if nft_balance.nft_address == nft_address {
                let owed_balance = nft_balance.royalties_balance.clone();
                nft_balance.royalties_balance = 0;
                return Ok(owed_balance)
            }
        }

        Err(ErrorCode::InvalidNft.into())
    }
}

#[error]
pub enum ErrorCode {
    #[msg("Error: NFT address not found in ledger")]
    InvalidNft,
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
}

