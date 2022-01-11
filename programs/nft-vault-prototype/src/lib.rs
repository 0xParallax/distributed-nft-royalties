use anchor_lang::prelude::*;
use anchor_lang::solana_program::system_instruction;
use anchor_lang::solana_program::program::{invoke_signed, invoke};
use anchor_spl::token::{Mint};

declare_id!("5GL4DTAqK5j4MFWkdrf51TGGvcFePMuLrDSpnAvfNgqT");

#[program]
pub mod nft_vault_prototype {

    use super::*;
    pub fn initialize_balance_ledger(_ctx: Context<InitializeBalanceLedger>) -> ProgramResult {

        //ctx.accounts.vault.authority = *ctx.accounts.authority.key;

        Ok(())
    }

    pub fn withdraw(ctx: Context<Withdraw>) -> ProgramResult {
        
        // Derive balance ledger PDA address
        let balance_ledger_pda = Pubkey::create_program_address(&[b"balance-ledger", &[254]], &id())?;

        assert_eq!(balance_ledger_pda, ctx.accounts.nft_balance_ledger.key());

        // Empty royalties_balance in ledger for given NFT
        // Errors out if NFT is not found in ledger
        let owed_royalties = ctx.accounts.nft_balance_ledger.empty_royalties_balance_for_nft(ctx.accounts.nft.key());

        let mut errored = false;

        match owed_royalties {
            Ok(amount) => {
                let ix = system_instruction::transfer(&ctx.accounts.pda_vault.key(), &ctx.accounts.to.key, amount);

                // Withdraw
                invoke_signed(
                    &ix, 
                    &[ctx.accounts.system_program.to_account_info(), ctx.accounts.pda_vault.to_account_info(), ctx.accounts.to.to_account_info()],
                    &[&[b"vault", &[255]]],
                )?;
            },
            Err(_) => errored = true
        }

        // TODO: figure out how to use ProgramResult
        if errored {
            return Err(ErrorCode::InvalidNft.into())
        }
        
        Ok(())
    }

    pub fn pay_label(ctx: Context<PayLabel>, amount: u64) -> ProgramResult {

        // Send sol to pda vault account
        let ix = system_instruction::transfer(&ctx.accounts.from.key, &ctx.accounts.pda_vault.key, amount);

        invoke(
            &ix, 
            &[ctx.accounts.system_program.to_account_info(), ctx.accounts.pda_vault.to_account_info(), ctx.accounts.from.to_account_info()],
        )?;

        // update the ledger nft balance royalties balance
        ctx.accounts.nft_balance_ledger.distribute_payments(amount);

        Ok(())
    }

    // TODO: modify to prod architecture to mint inside program
    pub fn test_mint_nft(ctx: Context<TestMintNft>, amount: u64) -> ProgramResult {
        
        // TODO: If label size is 0, all revenue goes to artist
        if ctx.accounts.nft_balance_ledger.size != 0 {
            // Send sol to pda vault account
            let ix = system_instruction::transfer(&ctx.accounts.payer.key, &ctx.accounts.pda_vault.key, amount);

            invoke(
                &ix, 
                &[ctx.accounts.system_program.to_account_info(), ctx.accounts.pda_vault.to_account_info(), ctx.accounts.payer.to_account_info()],
            )?;

            // update the ledger nft balance royalties balance
            ctx.accounts.nft_balance_ledger.distribute_payments(amount);
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
    fn distribute_payments(&mut self, amount: u64){
        // Todo: Error here if size is zero
        if self.size == 0{
            return
        }

        // Todo: Ensure rounding doesn't introduce vulnerability
        let amount_to_distribute = amount / self.size;

        for nft_balance in self.nft_balances.iter_mut() {
            nft_balance.royalties_balance += amount_to_distribute;
        }
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
}

