const { ethers } = require("hardhat");



async function main() {

    const [deployer] = await ethers.getSigners();
    console.log('Deploying contracts with the account: ' + deployer.address + "\n");

    const DAI = "0xB2180448f8945C8Cc8AE9809E67D6bd27d8B2f2C";

    const firstEpochNumber = "550";
    const firstBlockNumber = "100";

    const governor = { address: deployer.address }
    const guardian  = { address: deployer.address }
    const policy = { address: deployer.address }
    const vault = { address: deployer.address }

    const Authority = await ethers.getContractFactory('OlympusAuthority');
    console.log('Deploying OlympusAuthority.sol')
    const authority = await Authority.deploy(
      governor.address,
      guardian.address,
      policy.address,
      vault.address
    );
    console.log( "OlympusAuthority: " + authority.address + '\n');

    console.log('Deploying OHM.sol')
    const OHM = await ethers.getContractFactory('OlympusERC20Token');
    const ohm = await OHM.deploy(
      authority.address
    );
    console.log( "OHM: " + ohm.address + '\n');

    console.log('Deploying SOHM.sol')
    const SOHM = await ethers.getContractFactory('sOlympus');
    const sOHM = await SOHM.deploy();
    console.log( "SOHM: " + sOHM.address + '\n');

    console.log('Deploying GOHM.sol')
    const GOHM = await ethers.getContractFactory('gOHM');
    const gOHM = await GOHM.deploy();
    console.log( "GOHM: " + gOHM.address + '\n');

    console.log('Deploying OlympusStaking.sol')
    const OlympusStaking = await ethers.getContractFactory('OlympusStaking');
    const staking = await OlympusStaking.deploy(
      ohm.address,
      sOHM.address,
      gOHM.address,
      '2200',
      firstEpochNumber,
      firstBlockNumber,
      authority.address
    );
    console.log( "OlympusStaking: " + staking.address + '\n');

    console.log(`gOHM.initialize(${staking.address}, ${sOHM.address})`)
    await gOHM.initialize(
      staking.address,
      sOHM.address
    );
    console.log('gOHM.initialize successful\n')

    console.log('Deploying OlympusTreasury.sol')
    const OlympusTreasury = await ethers.getContractFactory('OlympusTreasury');
    const olympusTreasury = await OlympusTreasury.deploy(
      ohm.address,
      '0',
      authority.address
    );
    console.log( "OlympusTreasury: " + olympusTreasury.address + '\n');

    console.log(`authority.pushVault(${olympusTreasury.address}, true)`)
    await authority.pushVault(olympusTreasury.address, true);
    console.log('success\n')

    await olympusTreasury.initialize();

    console.log(`olympusTreasury.queueTimelock("2", ${DAI}, ${DAI})`)
    await olympusTreasury.queueTimelock("2", DAI, DAI);
    console.log('success\n')

    // do we set distributor as 8 as quetimelock

    // do we set up a standard bonding calculator for LP tokens (ABI/DAI)

    // do we set up LP token as 5 as quetimelock

    console.log('Deploying Distributor.sol')
    const Distributor = await ethers.getContractFactory('Distributor');
    const distributor = await Distributor.deploy(
      olympusTreasury.address,
      ohm.address,
      staking.address,
      authority.address
    );
    console.log( "Distributor: " + distributor.address + '\n');

    console.log("sOHM.setIndex('1000000')")
    await sOHM.setIndex(1000000);
    console.log('success\n')

    console.log(`sOHM.setgOHM(${staking.address}, ${sOHM.address})`)
    await sOHM.setgOHM(gOHM.address);
    console.log('success\n')

    console.log(`sOHM.initialize(${staking.address}, ${olympusTreasury.address})`)
    await sOHM.initialize(staking.address, olympusTreasury.address);
    console.log('success\n')

    console.log(`staking.setDistributor(${distributor.address})`)
    await staking.setDistributor(distributor.address);
    console.log('success\n')

    console.log('Treasury: executing 0')
    await olympusTreasury.execute("0");
    console.log('success\n')

    console.lo
    console.log("Authority " + authority.address)
    console.log("GOHM: " + gOHM.address)
    console.log("OHM: " + ohm.address);
    console.log("Olympus Treasury: " + olympusTreasury.address);
    console.log("Staked Olympus: " + sOHM.address);
    console.log("Staking Contract: " + staking.address);
    console.log("Distributor: " + distributor.address);
}

main()
    .then(() => process.exit())
    .catch(error => {
        console.error(error);
        process.exit(1);
})
