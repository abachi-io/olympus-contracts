const { ethers } = require("hardhat");



async function main() {

    const [deployer] = await ethers.getSigners();
    console.log('Deploying contracts with the account: ' + deployer.address + "\n");

    console.log('Deploying DAI.sol')
    const MockDAI = await ethers.getContractFactory('DAI');
    const dai = await MockDAI.deploy(deployer.provider._network.chainId)
    console.log( "DAI: " + dai.address + '\n');

    console.log('Deploying FRAX.sol')
    const MockFRAX = await ethers.getContractFactory('FRAX');
    const frax = await MockFRAX.deploy(deployer.provider._network.chainId)
    console.log( "FRAX: " + frax.address + '\n');

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
    console.log('success\n');

    console.log('olympusTreasury.initialize()')
    await olympusTreasury.initialize();
    console.log('success\n');

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

    console.log(`olympusTreasury.queueTimelock("2", ${dai.address}, ${dai.address})`)
    await olympusTreasury.queueTimelock("2", dai.address, dai.address);
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

    console.log('Deploying BondDepository.sol')
    const DepositoryFactory = await ethers.getContractFactory('OlympusBondDepositoryV2');
    const depository = await DepositoryFactory.deploy(
      authority.address,
      ohm.address,
      gOHM.address,
      staking.address,
      olympusTreasury.address,
    );
    console.log( "DepositoryFactory: " + depository.address + '\n');


    /**
     * @notice             creates a new market type
     * @dev                current price should be in 9 decimals.
     * @param _quoteToken  token used to deposit
     * @param _market      [capacity (in OHM or quote), initial price / OHM (9 decimals), debt buffer (3 decimals)]
     * @param _booleans    [capacity in quote, fixed term]
     * @param _terms       [vesting length (if fixed term) or vested timestamp, conclusion timestamp]
     * @param _intervals   [deposit interval (seconds), tune interval (seconds)]
     * @return id_         ID of new bond market
     */

    let capacity = 10000e9;
    let initialPrice = 400e9;
    let buffer = 2e5;
    let vesting = 100;
    let timeToConclusion = 60 * 60 * 24; // 1 day
    let conclusion = Math.round((Date.now() / 1000), 0) + timeToConclusion; // now in seconds + time to conclusion
    let depositInterval = 60 * 60 * 4; // 4 hours
    let tuneInterval = 60 * 60; // 1 hour

    console.log("Creating bond")

    await depository.create(
        dai.address, // _quoteToken
        [capacity, initialPrice, buffer], // _market
        [false, true], // _booleans
        [vesting, conclusion], // _terms
        [depositInterval, tuneInterval] // _intervals
    );

    await depository.create(
        frax.address, // _quoteToken
        [capacity, initialPrice, buffer], // _market
        [false, true], // _booleans
        [vesting, conclusion], // _terms
        [depositInterval, tuneInterval] // _intervals
    );
    console.log("success\n")

    let liveMarkets = await depository.liveMarkets();
    console.log(liveMarkets)

    console.log('closing first bond')
    depository.close(0);
    liveMarkets = await depository.liveMarkets();
    console.log(liveMarkets)


    console.log('=================================================')
    console.log("Authority " + authority.address);
    console.log("OHM: " + ohm.address);
    console.log("Treasury: " + olympusTreasury.address);
    console.log("GOHM: " + gOHM.address)
    console.log("sOHM: " + sOHM.address);
    console.log("Staking: " + staking.address);
    console.log("Distributor: " + distributor.address);
    console.log("Depositry Factory: " + depository.address);
    console.log("Mock DAI: " + dai.address);
    console.log('=================================================')


}

main()
    .then(() => process.exit())
    .catch(error => {
        console.error(error);
        process.exit(1);
})
