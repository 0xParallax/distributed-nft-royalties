import * as anchor from '@project-serum/anchor';
import { Program } from '@project-serum/anchor';
import { NftVaultPrototype } from '../target/types/nft_vault_prototype';

describe('nft-vault-prototype', () => {

  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.Provider.env());

  const program = anchor.workspace.NftVaultPrototype as Program<NftVaultPrototype>;

  it('Is initialized!', async () => {
    // Add your test here.
    const tx = await program.rpc.initialize({});
    console.log("Your transaction signature", tx);
  });
});
