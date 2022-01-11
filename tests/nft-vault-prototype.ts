import * as anchor from '@project-serum/anchor';
import { Program } from '@project-serum/anchor';
import { NftVaultPrototype } from '../target/types/nft_vault_prototype';
import { assert } from 'chai'
import { mintNft } from "./mint-nft-helper";

describe('nft-vault-prototype', () => {

  // Configure the client to use the local cluster.
  let provider = anchor.Provider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.NftVaultPrototype as Program<NftVaultPrototype>;

  const LAMPORTS_PER_SOL = anchor.web3.LAMPORTS_PER_SOL; 
  const airdropAmount   = LAMPORTS_PER_SOL;
  const lampsToSend     =   500_000_000;
  const lampsToWithdraw =   250_000_000;


  let user1 = anchor.web3.Keypair.generate();
  let user2 = anchor.web3.Keypair.generate();

  let nft_1;
  let nft_mint_address_1;
  let user_keypair_1;
  let nft_price_1;

  let nft_2;
  let nft_mint_address_2;
  let user_keypair_2;
  let nft_price_2;

  let nft_3;
  let nft_mint_address_3;
  let user_keypair_3;
  let nft_price_3;

  let pdaVaultAddress;
  let pdaVaultBump;

  let pdaBalanceLedgerAddress;
  let pdaBalanceLedgerBump;

  it('Initialize global variables', async () => {
    // Create our PDA Vault account address
    [pdaVaultAddress, pdaVaultBump] = await anchor.web3.PublicKey.findProgramAddress([Buffer.from("vault")], program.programId);
    console.log(`bump: ${pdaVaultBump}, pubkey: ${pdaVaultAddress.toBase58()}`);

    // Create our PDA for the NFT Balance Ledger Account
    [pdaBalanceLedgerAddress, pdaBalanceLedgerBump] = await anchor.web3.PublicKey.findProgramAddress([Buffer.from("balance-ledger")], program.programId);
    console.log(`bump: ${pdaBalanceLedgerBump}, pubkey: ${pdaBalanceLedgerAddress.toBase58()}`);
  })

  it('Is initialized!', async () => {

    let balance = await provider.connection.getBalance(pdaVaultAddress);
    console.log("PDA Vault Initial Balance: ", balance);

    // Airdrop some sol
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(user1.publicKey, airdropAmount),
      "confirmed"
    );


    // Transfer rent exempt sol to create system program account for our PDA Vault
    let rentExempt = await provider.connection.getMinimumBalanceForRentExemption(0, "confirmed");

    console.log("Rent Exempt: ", rentExempt);

    let transferIx = anchor.web3.SystemProgram.transfer({fromPubkey: user1.publicKey, toPubkey: pdaVaultAddress, lamports: rentExempt});

    let transferTx = new anchor.web3.Transaction()
      .add(transferIx);

    await provider.connection.confirmTransaction(
      await provider.connection.sendTransaction(transferTx, [user1])
    );

    await provider.connection.confirmTransaction(
      await program.rpc.initializeBalanceLedger(
        {
          accounts: {
            nftBalanceLedger: pdaBalanceLedgerAddress,
            payer: user1.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId
          },
          signers: [user1]
        },
      
    ));

    let balanceUser1 = await provider.connection.getBalance(user1.publicKey);
    let balanceUser2 = await provider.connection.getBalance(user2.publicKey);
    let balancePda = await provider.connection.getBalance(pdaVaultAddress);


    console.log("Balance User1: ", balanceUser1);
    console.log("Balance User2: ", balanceUser2);
    console.log("Balance PDA Vault: ", balancePda);

    let owner = await (await provider.connection.getAccountInfo(pdaBalanceLedgerAddress)).owner;


    assert.equal(program.programId.toString(), owner.toString());

  });

  it('Send to vault using payLabel!', async () => {
    const programId = program.programId;
    
    let initialBalance = await provider.connection.getBalance(pdaVaultAddress);

    console.log("PDA Vault Initial Balance: ", initialBalance);

    await provider.connection.confirmTransaction(
      await program.rpc.payLabel(
        new anchor.BN(lampsToSend),
        {
          accounts: {
            from: user1.publicKey,
            pdaVault: pdaVaultAddress,
            nftBalanceLedger: pdaBalanceLedgerAddress,
            systemProgram: anchor.web3.SystemProgram.programId
          },
          signers: [user1]
        },
    ));


    let balanceUser1 = await provider.connection.getBalance(user1.publicKey);
    let balanceUser2 = await provider.connection.getBalance(user2.publicKey);
    let balancePda = await provider.connection.getBalance(pdaVaultAddress);


    console.log("Balance User1: ", balanceUser1);
    console.log("Balance User2: ", balanceUser2);
    console.log("Balance PDA Vault: ", balancePda);

    let pdaAccountInfo = await provider.connection.getAccountInfo(pdaVaultAddress, "confirmed");

    let pdaBalance = pdaAccountInfo.lamports;
  
    assert.equal(lampsToSend + initialBalance, pdaBalance);
  });

  it('Add nft to ledger!', async () => {
    let [pdaVaultAddress, pdavaultBump] = await anchor.web3.PublicKey.findProgramAddress([Buffer.from("vault")], program.programId);
    console.log(`bump: ${pdavaultBump}, pubkey: ${pdaVaultAddress.toBase58()}`);

    let [pdaBalanceLedgerAddress, pdaBalanceLedgerBump] = await anchor.web3.PublicKey.findProgramAddress([Buffer.from("balance-ledger")], program.programId);
    console.log(`bump: ${pdaBalanceLedgerBump}, pubkey: ${pdaBalanceLedgerAddress.toBase58()}`);

    /**
     * Mint NFT 1
     */
    nft_1 = await mintNft(provider);
    nft_mint_address_1 = nft_1.mintAddress;
    user_keypair_1 = nft_1.userKeypair;
    nft_price_1 = 1 * LAMPORTS_PER_SOL;

    /**
     * Resulting vault:
     * {
     *    {nft_mint_address_1, 0}
     * }
     */
    await provider.connection.confirmTransaction(
      await program.rpc.testMintNft(
        new anchor.BN(nft_price_1),
        {
          accounts: {
            payer: user_keypair_1.publicKey,
            pdaVault: pdaVaultAddress,
            nftBalanceLedger: pdaBalanceLedgerAddress,
            nftAddress: nft_mint_address_1,
            systemProgram: anchor.web3.SystemProgram.programId
          },
          signers: [user_keypair_1]
        }
    ));

    /**
     * Mint NFT 2
     */
    nft_2 = await mintNft(provider);
    nft_mint_address_2 = nft_2.mintAddress;
    user_keypair_2 = nft_2.userKeypair;
    nft_price_2 = 2 * LAMPORTS_PER_SOL;

    /**
     * Resulting vault:
     * {
     *    {nft_mint_address_1, 2 SOL},
     *    {nft_mint_address_2, 0}
     * }
     */
    await provider.connection.confirmTransaction(
      await program.rpc.testMintNft(
        new anchor.BN(nft_price_2),
        {
          accounts: {
            payer: user_keypair_2.publicKey,
            pdaVault: pdaVaultAddress,
            nftBalanceLedger: pdaBalanceLedgerAddress,
            nftAddress: nft_mint_address_2,
            systemProgram: anchor.web3.SystemProgram.programId
          },
          signers: [user_keypair_2]
        }
    ));

    /**
     * Mint NFT 3
     */
    nft_3 = await mintNft(provider);
    nft_mint_address_3 = nft_3.mintAddress;
    user_keypair_3 = nft_3.userKeypair;
    nft_price_3 = 3 * LAMPORTS_PER_SOL;

    /**
     * Resulting vault:
     * {
     *    {nft_mint_address_1, 3.5 SOL},
     *    {nft_mint_address_2, 1.5 SOL}
     *    {nft_mint_address_3, 0}
     * }
     */
    await provider.connection.confirmTransaction(
      await program.rpc.testMintNft(
        new anchor.BN(nft_price_3),
        {
          accounts: {
            payer: user_keypair_3.publicKey,
            pdaVault: pdaVaultAddress,
            nftBalanceLedger: pdaBalanceLedgerAddress,
            nftAddress: nft_mint_address_3,
            systemProgram: anchor.web3.SystemProgram.programId
          },
          signers: [user_keypair_3]
        }
    ));
  });
  
//
  it('Withdraw from vault!', async () => {

    /**
     * User 1 Withdrawal
     */
     const balanceUser1_before_withdraw = await provider.connection.getBalance(user_keypair_1.publicKey);
     console.log("User 1 Balance - Before Withdrawal: ", balanceUser1_before_withdraw);
      await provider.connection.confirmTransaction(
      await program.rpc.withdraw(
       {
         accounts: {
           to: user_keypair_1.publicKey,
           pdaVault: pdaVaultAddress,
           nft: nft_mint_address_1,
           nftBalanceLedger: pdaBalanceLedgerAddress,
           systemProgram: anchor.web3.SystemProgram.programId
         }
       },
   ));

   const balanceUser1_after_withdraw = await provider.connection.getBalance(user_keypair_1.publicKey);
   console.log("User 1 Balance - After Withdrawal: ", balanceUser1_after_withdraw);

   assert.equal(balanceUser1_before_withdraw + 3.5 * LAMPORTS_PER_SOL, balanceUser1_after_withdraw);

    // Print NftBalanceLedger data
    let ledgerAccountData = await program.account.nftBalanceLedger.fetch(pdaBalanceLedgerAddress);

    let nftBalances = ledgerAccountData.nftBalances;
    let size = ledgerAccountData.size.toNumber();

    for (let i = 0; i < size; i++) {
      let balance = nftBalances[i];
      console.log("Balance " + i + ": ", balance.royaltiesBalance.toNumber());
    }
  });
});
