import * as anchor from '@project-serum/anchor';

export const printBalance = async (provider: anchor.Provider, addresses: anchor.web3.PublicKey[], accountNames: string[]) => {
    if (addresses.length != accountNames.length) {
        throw new Error("Addresses or names array is not equal in length");
    }

    console.log("");
    console.log("");

    for (let i = 0; i < addresses.length; i++) {
        const balance = await provider.connection.getBalance(addresses[i]);
        console.log("Balance for " + accountNames[i] + ": " + balance);
    }
}

export const convertBasisPointsToPercentage = (basisPoints: number) => basisPoints / 10000;