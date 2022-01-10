import * as anchor from '@project-serum/anchor';
import { Program } from '@project-serum/anchor';
import { NftVaultPrototype } from '../target/types/nft_vault_prototype';
import { assert } from 'chai'

describe('nft-vault-prototype', () => {

  // Configure the client to use the local cluster.
  let provider = anchor.Provider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.NftVaultPrototype as Program<NftVaultPrototype>;

  const airdropAmount   = anchor.web3.LAMPORTS_PER_SOL;
  const lampsToSend     =   500_000_000;
  const lampsToWithdraw =   250_000_000;


  let user1 = anchor.web3.Keypair.generate();
  let user2 = anchor.web3.Keypair.generate();

  it('Is initialized!', async () => {
    const programId = program.programId;


    // Create our PDA Vault account address
    let [pdaVaultAddress, pdaVaultBump] = await anchor.web3.PublicKey.findProgramAddress([Buffer.from("vault")], programId);
    console.log(`bump: ${pdaVaultBump}, pubkey: ${pdaVaultAddress.toBase58()}`);

    let balance = await provider.connection.getBalance(pdaVaultAddress);

    console.log("PDA Initial Balance: ", balance);

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

    // Create our PDA for the NFT Balance Ledger Account
    let [pdaBalanceLedgerAddress, pdaBalanceLedgerBump] = await anchor.web3.PublicKey.findProgramAddress([Buffer.from("balance-ledger")], programId);
    console.log(`bump: ${pdaBalanceLedgerBump}, pubkey: ${pdaBalanceLedgerAddress.toBase58()}`);

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
    console.log("Balance   Pda: ", balancePda);

    let owner = await (await provider.connection.getAccountInfo(pdaBalanceLedgerAddress)).owner;


    assert.equal(programId.toString(), owner.toString());

  });

  //it('Send to vault!', async () => {
  //  const programId = program.programId;
//
  //  let [pda, bump] = await anchor.web3.PublicKey.findProgramAddress([Buffer.from("test")], programId);
  //  console.log(`bump: ${bump}, pubkey: ${pda.toBase58()}`);
//
  //  let balance = await provider.connection.getBalance(pda);
//
  //  console.log("PDA Initial Balance: ", balance);
//
  //  await provider.connection.confirmTransaction(
  //    await program.rpc.send(
  //      new anchor.BN(lampsToSend),
  //      {
  //        accounts: {
  //          from: user1.publicKey,
  //          pda: pda,
  //          vault: user1VaultAccessAccount,
  //          systemProgram: anchor.web3.SystemProgram.programId
  //        },
  //        signers: [user1]
  //      },
  //  ));
//
//
  //  let balanceUser1 = await provider.connection.getBalance(user1.publicKey);
  //  let balanceUser2 = await provider.connection.getBalance(user2.publicKey);
  //  let balancePda = await provider.connection.getBalance(pda);
//
//
  //  console.log("Balance User1: ", balanceUser1);
  //  console.log("Balance User2: ", balanceUser2);
  //  console.log("Balance   Pda: ", balancePda);
//
  //  let pdaAccountInfo = await provider.connection.getParsedAccountInfo(pda, "confirmed");
//
  //  let pdaBalance = pdaAccountInfo.value.lamports;
  //
  //  assert.equal(lampsToSend, pdaBalance);
  //});
//
  //it('Withdraw from vault!', async () => {
  //  const programId = program.programId;
//
  //  let [pda, bump] = await anchor.web3.PublicKey.findProgramAddress([Buffer.from("test")], programId);
  //  console.log(`bump: ${bump}, pubkey: ${pda.toBase58()}`);
//
  //  let pdaBalance = await provider.connection.getBalance(pda);
//
  //  console.log("PDA Initial Balance: ", pdaBalance);
//
//
  //  await provider.connection.confirmTransaction(
  //    await program.rpc.withdraw(
  //      new anchor.BN(lampsToWithdraw),
  //      {
  //        accounts: {
  //          to: user1.publicKey,
  //          pda: pda,
  //          vault: user1VaultAccessAccount,
  //          systemProgram: anchor.web3.SystemProgram.programId
  //        }
  //      },
  //  ));
//
//
  //  let balanceUser1 = await provider.connection.getBalance(user1.publicKey);
  //  let balanceUser2 = await provider.connection.getBalance(user2.publicKey);
  //  let balancePda = await provider.connection.getBalance(pda);
//
//
  //  console.log("Balance User1: ", balanceUser1);
  //  console.log("Balance User2: ", balanceUser2);
  //  console.log("Balance   Pda: ", balancePda);
//
  //  let pdaAccountInfo = await provider.connection.getParsedAccountInfo(pda, "confirmed");
//
  //  pdaBalance = pdaAccountInfo.value.lamports;
//
  //  assert.equal(lampsToSend - lampsToWithdraw, pdaBalance);
  //});
});
