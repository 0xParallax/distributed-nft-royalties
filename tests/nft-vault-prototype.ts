import * as anchor from '@project-serum/anchor';
import { Program } from '@project-serum/anchor';
import { NftVaultPrototype } from '../target/types/nft_vault_prototype';
import { assert } from 'chai'

describe('nft-vault-prototype', () => {

  // Configure the client to use the local cluster.
  let provider = anchor.Provider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.NftVaultPrototype as Program<NftVaultPrototype>;

  const airdropAmount   = 1_000_000_000;
  const lampsToSend     =   500_000_000;
  const lampsToWithdraw =   250_000_000;

  let user1 = anchor.web3.Keypair.generate();
  let user2 = anchor.web3.Keypair.generate();
  let vaultAccount = anchor.web3.Keypair.generate();

  it('Is initialized!', async () => {
    const programId = program.programId;

    let [pda, bump] = await anchor.web3.PublicKey.findProgramAddress([Buffer.from("test")], programId);
    console.log(`bump: ${bump}, pubkey: ${pda.toBase58()}`);

    let balance = await provider.connection.getBalance(pda);

    console.log("PDA Initial Balance: ", balance);

    // Airdrop some sol
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(user1.publicKey, airdropAmount),
      "confirmed"
    );


    // Send sol to pda
    //let tx = new anchor.web3.Transaction()
    //  .add(anchor.web3.SystemProgram.transfer({
    //      fromPubkey: user1.publicKey,
    //      toPubkey: pda,
    //      lamports: lampsToSend,
    //  }));

    //await anchor.web3.sendAndConfirmTransaction(provider.connection, tx, [user1]);


    let sig = await program.rpc.initializeVault(
      {
        accounts: {
          vault: vaultAccount.publicKey,
          authority: user1.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId
        },
        signers: [user1, vaultAccount],
      },
      
    );
    //await provider.connection.confirmTransaction(sig);
    let vaultAccountInfo = await provider.connection.getParsedAccountInfo(vaultAccount.publicKey, "recent");
    let owner = vaultAccountInfo.value.owner;

    console.log("User2 Account Owner: ", owner.toString());
    


    let balanceUser1 = await provider.connection.getBalance(user1.publicKey);
    let balanceUser2 = await provider.connection.getBalance(user2.publicKey);
    let balancePda = await provider.connection.getBalance(pda);


    console.log("Balance User1: ", balanceUser1);
    console.log("Balance User2: ", balanceUser2);
    console.log("Balance   Pda: ", balancePda);

    assert.equal(owner.toString(), programId.toString());

  });

  it('Send to vault!', async () => {
    const programId = program.programId;

    let [pda, bump] = await anchor.web3.PublicKey.findProgramAddress([Buffer.from("test")], programId);
    console.log(`bump: ${bump}, pubkey: ${pda.toBase58()}`);

    let balance = await provider.connection.getBalance(pda);

    console.log("PDA Initial Balance: ", balance);

    await program.rpc.send(
      new anchor.BN(lampsToSend),
      {
        accounts: {
          from: user1.publicKey,
          pda: pda,
          vault: vaultAccount.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId
        },
        signers: [user1]
      },
    );


    let balanceUser1 = await provider.connection.getBalance(user1.publicKey);
    let balanceUser2 = await provider.connection.getBalance(user2.publicKey);
    let balancePda = await provider.connection.getBalance(pda);


    console.log("Balance User1: ", balanceUser1);
    console.log("Balance User2: ", balanceUser2);
    console.log("Balance   Pda: ", balancePda);

    let pdaAccountInfo = await provider.connection.getParsedAccountInfo(pda, "confirmed");

    let pdaBalance = pdaAccountInfo.value.lamports;
  
    assert.equal(lampsToSend, pdaBalance);
  });

  it('Withdraw from vault!', async () => {
    const programId = program.programId;

    let [pda, bump] = await anchor.web3.PublicKey.findProgramAddress([Buffer.from("test")], programId);
    console.log(`bump: ${bump}, pubkey: ${pda.toBase58()}`);

    let balance = await provider.connection.getBalance(pda);

    console.log("PDA Initial Balance: ", balance);


    await program.rpc.withdraw(
      new anchor.BN(lampsToWithdraw),
      {
        accounts: {
          to: user1.publicKey,
          pda: pda,
          vault: vaultAccount.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId
        }
      },
    );


    let balanceUser1 = await provider.connection.getBalance(user1.publicKey);
    let balanceUser2 = await provider.connection.getBalance(user2.publicKey);
    let balancePda = await provider.connection.getBalance(pda);


    console.log("Balance User1: ", balanceUser1);
    console.log("Balance User2: ", balanceUser2);
    console.log("Balance   Pda: ", balancePda);

    let pdaAccountInfo = await provider.connection.getParsedAccountInfo(pda, "confirmed");

    let pdaBalance = pdaAccountInfo.value.lamports;

    assert.equal(lampsToSend - lampsToWithdraw, pdaBalance);
  });
});
