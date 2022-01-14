const { ethers } = require("hardhat");

const IS_PROD = false;
const NETWORK = IS_PROD ? "polygon" : "matic"
const EPOCH = IS_PROD ? "2200" : "10" // blocks, 2200 = ~8 hours
const SOHM_INDEX = IS_PROD ? "1000000" : "1000000"
const FIRST_EPOCH_NUMBER = IS_PROD ? "550" : "550"
const FIRST_BLOCK_NUMBER = IS_PROD ? "100" : "100"
const DAI = IS_PROD ? "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063" : "0xf16a450fDC96691d1e7C85F983Cd54eCa2b89278"
const TIME_LOCK = IS_PROD ? "0" : "0" // ohm used 6600
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"

let verifyLines = ""
function generateVerifyCL(contractAddress, constructorArgs) {
  let args = ""
  if(constructorArgs.length > 0) {
      for(let i = 0; i < constructorArgs.length; i++) {
        if(constructorArgs.length - 1 == i) {
          args+= `"${constructorArgs[i]}"`
        } else {
          args+= `"${constructorArgs[i]}" `
        }
      }
  }
  verifyLines += `npx hardhat verify --network ${IS_PROD ? "polygon" : "mumbai"} ${contractAddress} ${args} && `
}

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log('Deploying contracts with the account: ' + deployer.address + "\n");

    const governor = { address: deployer.address }
    const guardian  = { address: deployer.address }
    const policy = { address: deployer.address }
    const vault = { address: deployer.address }

    console.log('Attaching DAI.sol')
    const MockDAI = await ethers.getContractFactory('DAI');
    const dai = await MockDAI.attach(
      DAI
    );
    console.log( "DAI: " + dai.address + '\n');

    const Authority = await ethers.getContractFactory('OlympusAuthority');
    console.log('Deploying OlympusAuthority.sol')
    const authority = await Authority.deploy(
      governor.address,
      guardian.address,
      policy.address,
      vault.address
    );
    console.log( "OlympusAuthority: " + authority.address + '\n');
    generateVerifyCL(authority.address, [governor.address, guardian.address, policy.address, vault.address])

    console.log('Deploying OHM.sol')
    const OHM = await ethers.getContractFactory('OlympusERC20Token');
    const ohm = await OHM.deploy(
      authority.address
    );
    console.log( "OHM: " + ohm.address + '\n');
    generateVerifyCL(ohm.address, [authority.address])

    const IoU = await ethers.getContractFactory('IOUERC20Token');
    console.log('Deploying IOU.sol');
    const iou = await IoU.deploy(
      authority.address
    );
    console.log( "IOU: " + iou.address + '\n');

    generateVerifyCL(iou.address, [authority.address]);

    console.log('Deploying OlympusTreasury.sol')
    const OlympusTreasury = await ethers.getContractFactory('OlympusTreasury');
    const olympusTreasury = await OlympusTreasury.deploy(
      ohm.address,
      TIME_LOCK,
      authority.address
    );
    console.log( "OlympusTreasury: " + olympusTreasury.address + '\n');
    generateVerifyCL(olympusTreasury.address, [ohm.address, TIME_LOCK, authority.address])

    if(!IS_PROD) {
      await ohm.mint(deployer.address, "117300000000000")
    }

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
    generateVerifyCL(sOHM.address, [])


    console.log('Deploying GOHM.sol')
    const GOHM = await ethers.getContractFactory('gOHM');
    const gOHM = await GOHM.deploy();
    console.log( "GOHM: " + gOHM.address + '\n');
    generateVerifyCL(gOHM.address, [])

    console.log('Deploying OlympusStaking.sol')
    const OlympusStaking = await ethers.getContractFactory('OlympusStaking');
    const staking = await OlympusStaking.deploy(
      ohm.address,
      sOHM.address,
      gOHM.address,
      EPOCH,
      FIRST_EPOCH_NUMBER,
      FIRST_BLOCK_NUMBER,
      authority.address
    );
    console.log( "OlympusStaking: " + staking.address + '\n');
    generateVerifyCL(staking.address, [ohm.address, sOHM.address, gOHM.address, EPOCH, FIRST_EPOCH_NUMBER, FIRST_BLOCK_NUMBER, authority.address])

    console.log(`gOHM.initialize(${staking.address}, ${sOHM.address})`)
    await gOHM.initialize(
      staking.address,
      sOHM.address
    );
    console.log('gOHM.initialize successful\n')

    console.log('Deploying Distributor.sol')
    const Distributor = await ethers.getContractFactory('Distributor');
    const distributor = await Distributor.deploy(
      olympusTreasury.address,
      ohm.address,
      staking.address,
      authority.address
    );
    console.log( "Distributor: " + distributor.address + '\n');
    generateVerifyCL(distributor.address, [olympusTreasury.address, ohm.address, staking.address, authority.address])

    console.log('Deploying BondingCalculator.sol')
    const BondingCalculator = await ethers.getContractFactory('OlympusBondingCalculator');
    const bondingCalculator = await BondingCalculator.deploy(
      ohm.address,
    );
    console.log( "BondingCalculator: " + bondingCalculator.address + '\n');
    generateVerifyCL(bondingCalculator.address, [ohm.address])

    console.log('Initialize sOHM')
    await sOHM.setIndex(SOHM_INDEX);
    await sOHM.setgOHM(gOHM.address);
    await sOHM.initialize(staking.address, olympusTreasury.address);

    console.log('Staking: Set Distributor')
    await staking.setDistributor(distributor.address);

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
    generateVerifyCL(depository.address, [authority.address, ohm.address, gOHM.address, staking.address, olympusTreasury.address])

    console.log('Treasury: queueTimelock:')
    await olympusTreasury.queueTimelock("0", depository.address, depository.address);
    console.log('0')
    await olympusTreasury.queueTimelock("0", deployer.address, deployer.address)
    console.log('1')
    await olympusTreasury.queueTimelock("2", dai.address, dai.address);
    console.log('2')
    await olympusTreasury.queueTimelock("4", deployer.address, deployer.address);
    console.log('3')
    await olympusTreasury.queueTimelock("9", sOHM.address, sOHM.address);
    console.log('4')
    await olympusTreasury.queueTimelock("8", distributor.address, distributor.address);
    console.log('5')
    await olympusTreasury.queueTimelock("8", depository.address, depository.address);
    console.log('6')
    await olympusTreasury.queueTimelock("2", iou.address, iou.address);
    console.log('7')

    // await olympusTreasury.queueTimelock("4", abidaiLP, abidaiLP);
    console.log('success\n')

    // do we set up a standard bonding calculator for LP tokens (ABI/DAI)
    // do we set up LP token as 5 as quetimelock

    console.log('Treasury: executing:')
    await olympusTreasury.execute("0");
    console.log('0')
    await olympusTreasury.execute("1");
    console.log('1')
    await olympusTreasury.execute("2");
    console.log('2')
    await olympusTreasury.execute("3");
    console.log('3')
    await olympusTreasury.execute("4");
    console.log('4')
    await olympusTreasury.execute("5");
    console.log('5')
    await olympusTreasury.execute("6");
    console.log('6')
    await olympusTreasury.execute("7");
    console.log('7')

    console.log('success\n')

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

     if(!IS_PROD) {
       let initialDeposit = 1000000000000000000000
       // await dai.mint(deployer.address, initialDeposit);
       // await dai.approve(olympusTreasury.address, initialDeposit);
       await iou.mint(deployer.address, "117300000000000000000000");
       console.log('minted')
       await iou.approve(olympusTreasury.address, "117300000000000000000000");
       console.log('approved')
       await olympusTreasury.deposit("117300000000000000000000", iou.address, "0")
       console.log('deposited')
       const treasuryReserves = await olympusTreasury.totalReserves()
       console.log('Treasury Reserves', parseInt(treasuryReserves))

       let capacity = 8260000000000;
       let initialPrice = 56000000000;
       let buffer = 100000;
       let vesting = 1209600; // how long bond
       let timeToConclusion = 60 * 60 * 24; // 1 day
       let conclusion = Math.round((Date.now() / 1000), 0) + timeToConclusion; // now in seconds + time to conclusion
       let depositInterval = 21600 // 4 hours
       let tuneInterval = 86400; // 1 hour

       console.log('Creating DAI Bond')
       await depository.create(
          "0xf16a450fDC96691d1e7C85F983Cd54eCa2b89278", // _quoteToken
          [capacity, initialPrice, buffer], // _market
          [false, true], // _booleans
          [vesting, conclusion], // _terms
          [depositInterval, tuneInterval] // _intervals
        );

        await depository.deposit(0, "0", initialPrice, deployer.address, deployer.address )

      console.log("success\n")
      //
      // /**
      //  * @notice             deposit quote tokens in exchange for a bond from a specified market
      //  * @param _id          the ID of the market
      //  * @param _amount      the amount of quote token to spend
      //  * @param _maxPrice    the maximum price at which to buy
      //  * @param _user        the recipient of the payout
      //  * @param _referral    the front end operator address
      //  * @return payout_     the amount of gOHM due
      //  * @return expiry_     the timestamp at which payout is redeemable
      //  * @return index_      the user index of the Note (used to redeem or query information)
      //  */

      // await depository.deposit(1, "0", initialPrice, deployer.address, deployer.address )
     }

    console.log('=================================================')
    console.log("Authority " + authority.address);
    console.log("OHM: " + ohm.address);
    console.log("Treasury: " + olympusTreasury.address);
    console.log("GOHM: " + gOHM.address)
    console.log("sOHM: " + sOHM.address);
    console.log("Staking: " + staking.address);
    console.log("Distributor: " + distributor.address);
    console.log("Bonding Calculator " + bondingCalculator.address)
    console.log("Depositry Factory: " + depository.address);
    console.log("DAI: " + dai.address);
    console.log("IOU: " + iou.address);
    console.log('=================================================')
    console.log(verifyLines)
}

main()
    .then(() => process.exit())
    .catch(error => {
        console.error(error);
        process.exit(1);
})
