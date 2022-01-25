import * as anchor from '@project-serum/anchor';
import { Program } from '@project-serum/anchor';
import { NftVaultPrototype } from '../target/types/nft_vault_prototype';
import { assert } from 'chai'
import { mintNft } from "./mint-nft-helper";
import { printBalance, convertBasisPointsToPercentage } from './utils';

describe('nft-vault-prototype', () => {

  // Configure the client to use the local cluster.
  let provider = anchor.Provider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.NftVaultPrototype as Program<NftVaultPrototype>;

  const LAMPORTS_PER_SOL = anchor.web3.LAMPORTS_PER_SOL;
  const airdropAmount = LAMPORTS_PER_SOL;
  const lampsToSend = 500_000_000;
  const lampsToWithdraw = 250_000_000;

  let collectionAuthority = anchor.web3.Keypair.generate();

  let user1 = anchor.web3.Keypair.generate();
  let user2 = anchor.web3.Keypair.generate();

  let nft_1;

  let nft_2;

  let nft_3;

  let pdaCollectionConfigAddress;
  let pdaCollectionConfigBump;

  let pdaVaultAddress;
  let pdaVaultBump;

  let pdaNftLedgerAddress;
  let pdaBalanceLedgerBump;

  let artistLedgerPda;
  let artistLedgerBump;

  let secondaryPoolPda;
  let secondaryPoolBump;

  let rentExemptVaultAmount;

  /**
 * Defining collection parameters
 */
  let artistKeypair = anchor.web3.Keypair.generate();
  let artistAddress = artistKeypair.publicKey;
  let artist_mint_percentage = 8000;
  let label_mint_percentage = 2000;
  let artist_secondary_percentage = 5000;
  let label_secondary_percentage = 5000;
  let artist_licensing_percentage = 6000;
  let label_licensing_percentage = 4000;

  it('Initialize global variables', async () => {
    // Create our PDA for the Collection Config Account
    [pdaCollectionConfigAddress, pdaCollectionConfigBump] = await anchor.web3.PublicKey.findProgramAddress([Buffer.from("collection-config")], program.programId);
    console.log(`bump: ${pdaCollectionConfigBump}, pubkey: ${pdaCollectionConfigAddress.toBase58()}`);

    // Create our PDA Vault account address
    [pdaVaultAddress, pdaVaultBump] = await anchor.web3.PublicKey.findProgramAddress([Buffer.from("vault")], program.programId);
    console.log(`bump: ${pdaVaultBump}, pubkey: ${pdaVaultAddress.toBase58()}`);

    // Create our PDA for the NFT Balance Ledger Account
    [pdaNftLedgerAddress, pdaBalanceLedgerBump] = await anchor.web3.PublicKey.findProgramAddress([Buffer.from("nft-ledger")], program.programId);
    console.log(`bump: ${pdaBalanceLedgerBump}, pubkey: ${pdaNftLedgerAddress.toBase58()}`);

    [artistLedgerPda, artistLedgerBump] = await anchor.web3.PublicKey.findProgramAddress([Buffer.from("artist-ledger")], program.programId);
    console.log(`bump: ${artistLedgerBump}, pubkey: ${artistLedgerPda.toBase58()}`);

    [secondaryPoolPda, secondaryPoolBump] = await anchor.web3.PublicKey.findProgramAddress([Buffer.from("secondary-pool")], program.programId);
    console.log(`bump: ${secondaryPoolBump}, pubkey: ${secondaryPoolPda.toBase58()}`);
  })

  /**
   * Initializes collection:
   * 
   * 1. Airdrops to collection authority
   * 2. Initialize Vault PDA by sending rent exemption
   * 3. Try to initialize with wrong configs
   * 4. Initialize with correct configs
   * 5. Verify values were written correctly.
   */
  it('Initialize Collection!', async () => {
    // TODO: do PDAs have to be initialized by sending SOL or not?

    // Airdrop some sol
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(collectionAuthority.publicKey, airdropAmount),
      "confirmed"
    );

    await printBalance(provider, [pdaVaultAddress, pdaCollectionConfigAddress, collectionAuthority.publicKey], ["pdaVaultAddress", "pdaCollectionConfigAddress", "collectionAuthority"])

    /**
     * We transfer rent exempt SOL amount to 
     * vault PDA to initialize it. We could
     * do this in Anchor side
     */
    rentExemptVaultAmount = await provider.connection.getMinimumBalanceForRentExemption(0, "confirmed");
    let transferIx = anchor.web3.SystemProgram.transfer({ fromPubkey: collectionAuthority.publicKey, toPubkey: pdaVaultAddress, lamports: rentExemptVaultAmount });
    let transferTx = new anchor.web3.Transaction()
      .add(transferIx);

    // TODO: Could we use existing PDA as this separate vault?
    await provider.connection.confirmTransaction(
      await provider.connection.sendTransaction(transferTx, [collectionAuthority])
    );

    /**
     * Scenario 3.1: Try init with incorrect mint percentages
     */
    try {
      await provider.connection.confirmTransaction(
        await program.rpc.initializeCollection(
          new anchor.BN(3000), // artist_mint_percentage
          new anchor.BN(2000), // label_mint_percentage
          new anchor.BN(5000), // artist_secondary_percentage
          new anchor.BN(5000), // label_secondary_percentage
          new anchor.BN(artist_licensing_percentage),
          new anchor.BN(label_licensing_percentage),
          artistAddress,
          {
            accounts: {
              collectionConfig: pdaCollectionConfigAddress,
              nftBalanceLedger: pdaNftLedgerAddress,
              artistBalanceLedger: artistLedgerPda,
              payer: collectionAuthority.publicKey,
              systemProgram: anchor.web3.SystemProgram.programId
            },
            signers: [collectionAuthority]
          }
        ));
    } catch (err) {
      const errorMessage = "Error: Invalid Collection Config parameters";
      console.log(err);
      assert.equal(errorMessage, err.toString());
    }

    /**
     * Scenario 3.2: Try init with incorrect mint percentages
     */
    try {
      await provider.connection.confirmTransaction(
        await program.rpc.initializeCollection(
          new anchor.BN(8000), // artist_mint_percentage
          new anchor.BN(2000), // label_mint_percentage
          new anchor.BN(4000), // artist_secondary_percentage
          new anchor.BN(5000), // label_secondary_percentage
          new anchor.BN(artist_licensing_percentage),
          new anchor.BN(label_licensing_percentage),
          artistAddress,
          {
            accounts: {
              collectionConfig: pdaCollectionConfigAddress,
              nftBalanceLedger: pdaNftLedgerAddress,
              artistBalanceLedger: artistLedgerPda,
              payer: collectionAuthority.publicKey,
              systemProgram: anchor.web3.SystemProgram.programId
            },
            signers: [collectionAuthority]
          }
        ));
    } catch (err) {
      const errorMessage = "Error: Invalid Collection Config parameters";
      console.log(err);
      assert.equal(errorMessage, err.toString());
    }

    /**
 * Scenario 3.3: Try init with incorrect licensing percentages
 */
    try {
      await provider.connection.confirmTransaction(
        await program.rpc.initializeCollection(
          new anchor.BN(8000), // artist_mint_percentage
          new anchor.BN(2000), // label_mint_percentage
          new anchor.BN(5000), // artist_secondary_percentage
          new anchor.BN(5000), // label_secondary_percentage
          new anchor.BN(2000), // artist_licensing_percentage
          new anchor.BN(5000), // label_licensing_percentage
          artistAddress,
          {
            accounts: {
              collectionConfig: pdaCollectionConfigAddress,
              nftBalanceLedger: pdaNftLedgerAddress,
              artistBalanceLedger: artistLedgerPda,
              payer: collectionAuthority.publicKey,
              systemProgram: anchor.web3.SystemProgram.programId
            },
            signers: [collectionAuthority]
          }
        ));
    } catch (err) {
      const errorMessage = "Error: Invalid Collection Config parameters";
      console.log(err);
      assert.equal(errorMessage, err.toString());
    }

    /**
     * Scenario 4: Initialize with correct configs
     */
    await provider.connection.confirmTransaction(
      await program.rpc.initializeCollection(
        new anchor.BN(artist_mint_percentage), // artist_mint_percentage
        new anchor.BN(label_mint_percentage), // label_mint_percentage
        new anchor.BN(artist_secondary_percentage), // artist_secondary_percentage
        new anchor.BN(label_secondary_percentage), // label_secondary_percentage
        new anchor.BN(artist_licensing_percentage), // artist_licensing_percentage
        new anchor.BN(label_licensing_percentage), // label_licensing_percentage
        artistAddress, // TODO: figure out how to serialize artist splits
        {
          accounts: {
            collectionConfig: pdaCollectionConfigAddress,
            nftBalanceLedger: pdaNftLedgerAddress,
            artistBalanceLedger: artistLedgerPda,
            payer: collectionAuthority.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId
          },
          signers: [collectionAuthority]
        }
      ));

    await printBalance(provider, [user1.publicKey, user2.publicKey, pdaVaultAddress, pdaCollectionConfigAddress, collectionAuthority.publicKey, pdaNftLedgerAddress, artistLedgerPda],
      ["user1", "user2", "pdaVaultAddress", "pdaCollectionConfigAddress", "collectionAuthority", "pdaNftLedgerAddress", "artistLedgerPda"])

    /**
     * Scenario 5.1: Verify owner values are correct
     */
    let ownerNftLedger = await (await provider.connection.getAccountInfo(pdaNftLedgerAddress)).owner;
    let ownerArtistLedger = await (await provider.connection.getAccountInfo(artistLedgerPda)).owner;
    let ownerCollectionConfig = await (await provider.connection.getAccountInfo(pdaCollectionConfigAddress)).owner;
    let ownerVault = await (await provider.connection.getAccountInfo(pdaVaultAddress)).owner;

    /**
     * Ensuring these accounts are owned by our program
     */
    assert.equal(program.programId.toString(), ownerNftLedger.toString());
    assert.equal(program.programId.toString(), ownerCollectionConfig.toString());
    assert.equal(program.programId.toString(), ownerArtistLedger.toString());

    /**
     * Ensuring the vault has been initialized
     */
    assert.equal(anchor.web3.SystemProgram.programId.toString(), ownerVault.toString());

    /**
     * Scenario 5.2: Verifying collection config metadata was written correctly
     */
    let collectionConfig = await program.account.collectionConfiguration.fetch(pdaCollectionConfigAddress);

    // Collection authority
    let collectionAuthorityResult = collectionConfig.collectionAuthority.toBase58();
    assert.equal(collectionAuthorityResult, collectionAuthority.publicKey.toBase58());

    // Label percentages
    let artistMintPercentageResult = collectionConfig.artistMintPercentage;
    let labelMintPercentageResult = collectionConfig.labelMintPercentage;
    let artistSecondaryPercentageResult = collectionConfig.artistSecondaryPercentage;
    let labelSecondaryPercentageResult = collectionConfig.labelSecondaryPercentage;

    assert.equal(artistMintPercentageResult.toNumber(), artist_mint_percentage)
    assert.equal(labelMintPercentageResult.toNumber(), label_mint_percentage)
    assert.equal(artistSecondaryPercentageResult.toNumber(), artist_secondary_percentage)
    assert.equal(labelSecondaryPercentageResult.toNumber(), label_secondary_percentage)

    // TODO: verify artist splits
    // artistSplits: [ { artistAddress: [PublicKey], allocatedPercentage: <BN: 2710> } ]

    // TODO: verify artist ledger
  });

  it('Add nft to ledger!', async () => {
    /**
    * * * * * * * * * * * *
    *   
    *     Mint NFT 1
    * 
    * * * * * * * * * * * *
    */
    nft_1 = await mintNft(provider, 1 * LAMPORTS_PER_SOL, pdaVaultAddress);

    /**
     * Scenario 1: Try with fake collection authority
     */
    try {
      let fakeCollectionAuthority = anchor.web3.Keypair.generate();

      await provider.connection.confirmTransaction(
        await program.rpc.addNft(
          new anchor.BN(nft_1.nftPrice),
          {
            accounts: {
              payer: nft_1.ownerKeypair.publicKey,
              collectionAuthority: fakeCollectionAuthority.publicKey,
              collectionConfig: pdaCollectionConfigAddress,
              artistBalanceLedger: artistLedgerPda,
              nftBalanceLedger: pdaNftLedgerAddress,
              nftAddress: nft_1.mintAddress,
              systemProgram: anchor.web3.SystemProgram.programId
            },
            signers: [nft_1.ownerKeypair, fakeCollectionAuthority]
          }
        ));
    } catch (err) {
      const errorMessage = "Error: Missing Collection Authority Signature";
      console.log(err);
      assert.equal(errorMessage, err.toString());
    }

    /**
     * Resulting vault:
     * {
     *    {nft_1.mintAddress, 0}
     * }
     * 
     * {
     *    {artist_1, 1 SOL}
     * }
     */
    await provider.connection.confirmTransaction(
      await program.rpc.addNft(
        new anchor.BN(nft_1.nftPrice),
        {
          accounts: {
            payer: nft_1.ownerKeypair.publicKey,
            collectionAuthority: collectionAuthority.publicKey,
            collectionConfig: pdaCollectionConfigAddress,
            artistBalanceLedger: artistLedgerPda,
            nftBalanceLedger: pdaNftLedgerAddress,
            nftAddress: nft_1.mintAddress,
            systemProgram: anchor.web3.SystemProgram.programId
          },
          signers: [nft_1.ownerKeypair, collectionAuthority]
        }
      ));

    /**
     * Verify NFT ledger balance and size
     */
    let nftBalanceLedger = await program.account.nftBalanceLedger.fetch(pdaNftLedgerAddress);
    let nftBalances = nftBalanceLedger.nftBalances as any[];
    let nft1_balance_1 = nftBalanceLedger.nftBalances[0].royaltiesBalance.toNumber();

    assert.equal(0, nft1_balance_1);
    assert.equal(1, nftBalances.length);
    assert.equal(nftBalanceLedger.size, nftBalances.length);

    /**
     * Verify Artist ledger balance and size
     */
    let artistBalanceLedger = await program.account.artistBalanceLedger.fetch(artistLedgerPda);
    let artistBalances = artistBalanceLedger.artistBalances as any[];
    assert.equal(artistBalances.length, artistBalanceLedger.size);
    assert.equal(artistBalanceLedger.size, 1);

    const artistBalance_1 = artistBalances[0].royaltiesBalance;
    assert.equal(artistBalance_1, nft_1.nftPrice);

    /**
     * Verify Vault balance
     */

    let pdaVaultBalance_1 = await provider.connection.getBalance(pdaVaultAddress);
    assert.equal(pdaVaultBalance_1, nft_1.nftPrice + rentExemptVaultAmount)
    printBalance(provider, [pdaVaultAddress], ["pdaVaultAddress"]);

    /**
    * * * * * * * * * * * *
    *   
    *     Mint NFT 2
    * 
    * * * * * * * * * * * *
    */
    const nft_2_price = 2 * LAMPORTS_PER_SOL;
    nft_2 = await mintNft(provider, nft_2_price, pdaVaultAddress);
    const expectedArtistBalance_2 = artistBalance_1.toNumber() + (nft_2_price * convertBasisPointsToPercentage(artist_mint_percentage));
    const expectedNft1Balance = nft1_balance_1 + (nft_2_price * convertBasisPointsToPercentage(label_mint_percentage));
    const expectedNft2Balance = 0;

    printBalance(provider, [pdaVaultAddress], ["pdaVaultAddress"]);

    /**
     * Resulting vault:
     * {
     *    {nft_1.mintAddress, 0.4 SOL},
     *    {nft_2.mintAddress, 0}
     * }
     * 
     * {
     *    {artist_1, 2.6 SOL}
     * }
     */
    await provider.connection.confirmTransaction(
      await program.rpc.addNft(
        new anchor.BN(nft_2.nftPrice),
        {
          accounts: {
            payer: nft_2.ownerKeypair.publicKey,
            collectionAuthority: collectionAuthority.publicKey,
            collectionConfig: pdaCollectionConfigAddress,
            artistBalanceLedger: artistLedgerPda,
            nftBalanceLedger: pdaNftLedgerAddress,
            nftAddress: nft_2.mintAddress,
            systemProgram: anchor.web3.SystemProgram.programId
          },
          signers: [nft_2.ownerKeypair, collectionAuthority]
        }
      ));

    /**
     * Verify NFT ledger balance and size
     */
    nftBalanceLedger = await program.account.nftBalanceLedger.fetch(pdaNftLedgerAddress);
    nftBalances = nftBalanceLedger.nftBalances as any[];

    let nft1_balance_2 = nftBalanceLedger.nftBalances[0].royaltiesBalance.toNumber();
    let nft2_balance_2 = nftBalanceLedger.nftBalances[1].royaltiesBalance.toNumber();

    assert.equal(expectedNft1Balance, nft1_balance_2);
    assert.equal(expectedNft2Balance, nft2_balance_2);
    assert.equal(nftBalances.length, 2);
    assert.equal(nftBalanceLedger.size, nftBalances.length);

    /**
     * Verify Artist ledger balance and size
     */
    artistBalanceLedger = await program.account.artistBalanceLedger.fetch(artistLedgerPda);
    artistBalances = artistBalanceLedger.artistBalances as any[];
    assert.equal(artistBalances.length, artistBalanceLedger.size);
    assert.equal(artistBalanceLedger.size, 1);

    const artistBalance_2 = artistBalances[0].royaltiesBalance;
    assert.equal(artistBalance_2.toNumber(), expectedArtistBalance_2);

    /**
     * Verify Vault balance
     */
    let pdaVaultBalance_2 = await provider.connection.getBalance(pdaVaultAddress);
    assert.equal(pdaVaultBalance_2, nft_1.nftPrice + nft_2.nftPrice + rentExemptVaultAmount)
    printBalance(provider, [pdaVaultAddress], ["pdaVaultAddress"]);


    /**
    * * * * * * * * * * * *
    *   
    *     Mint NFT 3
    * 
    * * * * * * * * * * * *
    */
    const nft_3_price = 3 * LAMPORTS_PER_SOL;
    nft_3 = await mintNft(provider, nft_3_price, pdaVaultAddress);

    /**
     * Calculate expected results.
     * 
     */
    const expectedArtistBalance_3 = artistBalance_2.toNumber() + (nft_3_price * convertBasisPointsToPercentage(artist_mint_percentage));
    const expectedNft1Balance_3 = nft1_balance_2 + (nft_3_price * convertBasisPointsToPercentage(label_mint_percentage)) / 2; // Don't forget to divide by size of label ledger...
    const expectedNft2Balance_3 = nft2_balance_2 + (nft_3_price * convertBasisPointsToPercentage(label_mint_percentage)) / 2;
    const expectedNft3Balance_3 = 0;

    printBalance(provider, [pdaVaultAddress], ["pdaVaultAddress"]);

    /**
     * Resulting vault:
     * {
     *    {nft_1.mintAddress, 0.7 SOL},
     *    {nft_2.mintAddress, 0.3 SOL}
     *    {nft_3.mintAddress, 0}
     * }
     * 
     * {
     *    {artist_1, 5 SOL}
     * }
     */
    await provider.connection.confirmTransaction(
      await program.rpc.addNft(
        new anchor.BN(nft_3.nftPrice),
        {
          accounts: {
            payer: nft_3.ownerKeypair.publicKey,
            collectionAuthority: collectionAuthority.publicKey,
            collectionConfig: pdaCollectionConfigAddress,
            artistBalanceLedger: artistLedgerPda,
            nftBalanceLedger: pdaNftLedgerAddress,
            nftAddress: nft_3.mintAddress,
            systemProgram: anchor.web3.SystemProgram.programId
          },
          signers: [nft_3.ownerKeypair, collectionAuthority]
        }
      ));

    /**
     * Verify NFT ledger balance and size
     */
    nftBalanceLedger = await program.account.nftBalanceLedger.fetch(pdaNftLedgerAddress);
    nftBalances = nftBalanceLedger.nftBalances as any[];

    let nft1_balance_3 = nftBalanceLedger.nftBalances[0].royaltiesBalance.toNumber();
    let nft2_balance_3 = nftBalanceLedger.nftBalances[1].royaltiesBalance.toNumber();
    let nft3_balance_3 = nftBalanceLedger.nftBalances[2].royaltiesBalance.toNumber();

    assert.equal(expectedNft1Balance_3, nft1_balance_3);
    assert.equal(expectedNft2Balance_3, nft2_balance_3);
    assert.equal(expectedNft3Balance_3, nft3_balance_3);
    assert.equal(nftBalances.length, 3);
    assert.equal(nftBalanceLedger.size.toNumber(), nftBalances.length);

    /**
     * Verify Artist ledger balance and size
     */
    artistBalanceLedger = await program.account.artistBalanceLedger.fetch(artistLedgerPda);
    artistBalances = artistBalanceLedger.artistBalances as any[];
    assert.equal(artistBalances.length, artistBalanceLedger.size);
    assert.equal(artistBalanceLedger.size, 1);

    const artistBalance_3 = artistBalances[0].royaltiesBalance;
    assert.equal(artistBalance_3.toNumber(), expectedArtistBalance_3);

    /**
     * Verify Vault balance
     */
    let pdaVaultBalance_3 = await provider.connection.getBalance(pdaVaultAddress);
    assert.equal(pdaVaultBalance_3, nft_1.nftPrice + nft_2.nftPrice + nft_3.nftPrice + rentExemptVaultAmount)
    printBalance(provider, [pdaVaultAddress], ["pdaVaultAddress"]);
  });

  /**
   * 
   * Members Withdraw
   * 
   * TODO: add scenarios
   * - User tries to withdraw null balance
   * - User tries to withdraw balance for invalid nft
   * - User tries to withdraw balance for ass_acc with balance 0
   */
  it('Member withdraw from vault!', async () => {

    /**
     * User 1 Withdrawal
     */
    const initialBalance = await provider.connection.getBalance(nft_1.ownerKeypair.publicKey);
    console.log("User 1 Balance - Before Withdrawal: ", initialBalance);

    const initialRoyalties = await (await program.account.nftBalanceLedger.fetch(pdaNftLedgerAddress)).nftBalances[0].royaltiesBalance.toNumber();

    const largestAccounts = await provider.connection.getTokenLargestAccounts(new anchor.web3.PublicKey(nft_1.mintAddress));
    let nft_associated_account = largestAccounts.value[0].address;

    let ledgerAccountData = await program.account.nftBalanceLedger.fetch(pdaNftLedgerAddress);

    let nftBalances = ledgerAccountData.nftBalances;
    let size = ledgerAccountData.size.toNumber();

    for (let i = 0; i < size; i++) {
      let balance = nftBalances[i];
      console.log("Initial Balance " + i + ": ", balance.royaltiesBalance.toNumber());
    }

    await provider.connection.confirmTransaction(
      await program.rpc.memberWithdraw(
        {
          accounts: {
            to: nft_1.ownerKeypair.publicKey,
            pdaVault: pdaVaultAddress,
            nft: nft_1.mintAddress,
            nftAssociatedAccount: nft_associated_account,
            nftBalanceLedger: pdaNftLedgerAddress,
            systemProgram: anchor.web3.SystemProgram.programId
          }
        },
      ));

    // fetch NftBalanceLedger data
    ledgerAccountData = await program.account.nftBalanceLedger.fetch(pdaNftLedgerAddress);

    nftBalances = ledgerAccountData.nftBalances;
    size = ledgerAccountData.size.toNumber();

    for (let i = 0; i < size; i++) {
      let balance = nftBalances[i];
      console.log("After Balance " + i + ": ", balance.royaltiesBalance.toNumber());
    }

    const balanceUser1_after_withdraw = await provider.connection.getBalance(nft_1.ownerKeypair.publicKey);
    console.log("User 1 Balance - After Withdrawal: ", balanceUser1_after_withdraw);

    assert.equal(initialBalance + initialRoyalties, balanceUser1_after_withdraw);
  });

  /**
     * 
     * Artist Withdraw
     * 
     * TODO: add scenarios
     * - Not an artist
     * - Invalid PDA
     * - User tries to withdraw balance for ass_acc with balance 0
     * - Not signed by authority
     */
  it('Artist withdraw from vault!', async () => {

    /**
     * Artist 1 Withdrawal
     */
    const initialBalance = await provider.connection.getBalance(artistAddress);
    console.log("Artist 1 Balance - Before Withdrawal: ", initialBalance);

    const initialRoyalties = await (await program.account.artistBalanceLedger.fetch(artistLedgerPda)).artistBalances[0].royaltiesBalance.toNumber();
    console.log("Ledger Balance - Before Withdrawal: ", initialRoyalties);

    printBalance(provider, [pdaVaultAddress], ["pda-vault-before"]);

    await provider.connection.confirmTransaction(
      await program.rpc.artistWithdraw(
        {
          accounts: {
            artistAccount: artistAddress,
            pdaVault: pdaVaultAddress,
            artistBalanceLedger: artistLedgerPda,
            systemProgram: anchor.web3.SystemProgram.programId
          }
        },
      ));

    const balanceArtist1_after_withdraw = await provider.connection.getBalance(artistAddress);
    console.log("Artist 1 Balance - After Withdrawal: ", balanceArtist1_after_withdraw);

    const resultingRoyalties = await (await program.account.artistBalanceLedger.fetch(artistLedgerPda)).artistBalances[0].royaltiesBalance.toNumber();
    console.log("Ledger Balance - After Withdrawal: ", resultingRoyalties);

    printBalance(provider, [pdaVaultAddress], ["pda-vault-after"]);

    assert.equal(initialBalance + initialRoyalties, balanceArtist1_after_withdraw);
  });

  it('Pay licensing fee', async () => {

  })

  it('Distribute secondary pool', async () => {

    // Airdrop some sol
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(secondaryPoolPda, airdropAmount),
      "confirmed"
    );

    const secondaryPoolBalance_Before = await provider.connection.getBalance(secondaryPoolPda);
    printBalance(provider, [secondaryPoolPda], ['before - secondary-pool']);

    const artistLedger_Before = await (await program.account.artistBalanceLedger.fetch(artistLedgerPda)).artistBalances as any[]; // [0].royaltiesBalance.toNumber();
    const nftLedger_Before = await (await program.account.nftBalanceLedger.fetch(pdaNftLedgerAddress)).nftBalances as any[];

    // Distribute secondary pool
    await provider.connection.confirmTransaction(
      await program.rpc.distributeSecondaryPool(
        {
          accounts: {
            pdaVault: pdaVaultAddress,
            pdaSecondaryPool: secondaryPoolPda,
            collectionConfig: pdaCollectionConfigAddress,
            artistBalanceLedger: artistLedgerPda,
            nftBalanceLedger: pdaNftLedgerAddress,
            systemProgram: anchor.web3.SystemProgram.programId
          }
        },
      ));

    const secondaryPoolBalance_After = await provider.connection.getBalance(secondaryPoolPda);
    printBalance(provider, [secondaryPoolPda], ['after - secondary-pool']);

    assert.equal(secondaryPoolBalance_After, 0);
    assert.equal(secondaryPoolBalance_Before - secondaryPoolBalance_After, airdropAmount);

    const artistLedger_After = await (await program.account.artistBalanceLedger.fetch(artistLedgerPda)).artistBalances as any[]; // [0].royaltiesBalance.toNumber();
    const nftLedger_After = await (await program.account.nftBalanceLedger.fetch(pdaNftLedgerAddress)).nftBalances as any[];

    /**
     * Verify Artist Ledger amounts
     */
    const amountDistributedToArtists = Math.floor(airdropAmount * convertBasisPointsToPercentage(artist_secondary_percentage));
    for (let i = 0; i < artistLedger_After.length; i++) {
      const difference = artistLedger_After[i].royaltiesBalance.toNumber() - artistLedger_Before[i].royaltiesBalance.toNumber();
      // TODO: add support for multi artist
      assert.equal(difference, amountDistributedToArtists);
    }

    /**
     * Verify Member Ledger amounts
     */
    const amountDistributedToEachMember = Math.floor(airdropAmount * convertBasisPointsToPercentage(label_secondary_percentage) / nftLedger_After.length);
    for (let i = 0; i < nftLedger_After.length; i++) {
      const difference = nftLedger_After[i].royaltiesBalance.toNumber() - nftLedger_Before[i].royaltiesBalance.toNumber();
      assert.equal(difference, amountDistributedToEachMember);
    }
  })

  it('Pay Licensing fee!', async () => {

    // Airdrop some sol
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(user1.publicKey, airdropAmount),
      "confirmed"
    );

    const user1_Before = await provider.connection.getBalance(user1.publicKey);
    printBalance(provider, [user1.publicKey], ['before - user1']);

    const vault_Before = await provider.connection.getBalance(pdaVaultAddress);
    printBalance(provider, [pdaVaultAddress], ['before - vault']);

    const artistLedger_Before = await (await program.account.artistBalanceLedger.fetch(artistLedgerPda)).artistBalances as any[]; // [0].royaltiesBalance.toNumber();
    const nftLedger_Before = await (await program.account.nftBalanceLedger.fetch(pdaNftLedgerAddress)).nftBalances as any[];

    // Distribute secondary pool
    await provider.connection.confirmTransaction(
      await program.rpc.payLicensingFee(
        new anchor.BN(airdropAmount), // amount
        {
          accounts: {
            from: user1.publicKey,
            pdaVault: pdaVaultAddress,
            collectionConfig: pdaCollectionConfigAddress,
            artistBalanceLedger: artistLedgerPda,
            nftBalanceLedger: pdaNftLedgerAddress,
            systemProgram: anchor.web3.SystemProgram.programId
          },
          signers: [user1]
        },
      ));

    /**
     * Verify amount of Sol was transferred from User 1 to Vault.
     */
    const user1_After = await provider.connection.getBalance(user1.publicKey);
    printBalance(provider, [user1.publicKey], ['after - user1']);

    const vault_After = await provider.connection.getBalance(pdaVaultAddress);
    printBalance(provider, [pdaVaultAddress], ['after - vault']);

    assert.equal(user1_Before - user1_After, airdropAmount);
    assert.equal(vault_After - vault_Before, airdropAmount);

    const artistLedger_After = await (await program.account.artistBalanceLedger.fetch(artistLedgerPda)).artistBalances as any[]; // [0].royaltiesBalance.toNumber();
    const nftLedger_After = await (await program.account.nftBalanceLedger.fetch(pdaNftLedgerAddress)).nftBalances as any[];

    /**
     * Verify Artist Ledger amounts
     */
    const amountDistributedToArtists = Math.floor(airdropAmount * convertBasisPointsToPercentage(artist_licensing_percentage));
    for (let i = 0; i < artistLedger_After.length; i++) {
      const difference = artistLedger_After[i].royaltiesBalance.toNumber() - artistLedger_Before[i].royaltiesBalance.toNumber();
      // TODO: add support for multi artist
      assert.equal(difference, amountDistributedToArtists);
    }

    /**
     * Verify Member Ledger amounts
     */
    const amountDistributedToEachMember = Math.floor(airdropAmount * convertBasisPointsToPercentage(label_licensing_percentage) / nftLedger_After.length);
    for (let i = 0; i < nftLedger_After.length; i++) {
      const difference = nftLedger_After[i].royaltiesBalance.toNumber() - nftLedger_Before[i].royaltiesBalance.toNumber();
      assert.equal(difference, amountDistributedToEachMember);
    }
  })

  it('Transfer Collection Authority!', async () => {
    let newCollectionAuthority = anchor.web3.Keypair.generate();

    let collectionConfig = await program.account.collectionConfiguration.fetch(pdaCollectionConfigAddress);
    let collectionAuthorityResult_Before = collectionConfig.collectionAuthority.toBase58();
    assert.equal(collectionAuthorityResult_Before, collectionAuthority.publicKey.toBase58());

    console.log("previous authority: ", collectionAuthority.publicKey.toBase58())

    // Try to sign with fake artist
    const fakeArtist = anchor.web3.Keypair.generate();

    try {
      await provider.connection.confirmTransaction(
        await program.rpc.transferCollectionAuthority(
          {
            accounts: {
              collectionConfig: pdaCollectionConfigAddress,
              currentCollectionAuthority: collectionAuthority.publicKey,
              artistAuthorizer: fakeArtist.publicKey,
              newCollectionAuthority: newCollectionAuthority.publicKey
            },
            signers: [collectionAuthority, fakeArtist]
          },
        ));
    } catch (err) {
      const errorMessage = "Error: Artist address not found in ledger";
      console.log(err);
      assert.equal(errorMessage, err.toString());
    }

    await provider.connection.confirmTransaction(
      await program.rpc.transferCollectionAuthority(
        {
          accounts: {
            collectionConfig: pdaCollectionConfigAddress,
            currentCollectionAuthority: collectionAuthority.publicKey,
            artistAuthorizer: artistKeypair.publicKey,
            newCollectionAuthority: newCollectionAuthority.publicKey
          },
          signers: [collectionAuthority, artistKeypair]
        },
      ));

    collectionConfig = await program.account.collectionConfiguration.fetch(pdaCollectionConfigAddress);
    let collectionAuthorityResult_After = collectionConfig.collectionAuthority.toBase58();
    assert.equal(collectionAuthorityResult_After, newCollectionAuthority.publicKey.toBase58());

    console.log("new authority: ", newCollectionAuthority.publicKey.toBase58())
  })
});
