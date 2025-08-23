#!/bin/bash

if [ "$EUID" -ne 0 ]
then echo "Please run with sudo"
exit
fi

cd /home/nvidia/Desktop/Zedx
### _____________________________________________________________________________________ 
# Camera Dependent Parameters
# - Default MAX9295 I2C Address
# - Special GPO to enable MAX9295
# - Framesync input on MAX9295
### _____________________________________________________________________________________
function setGPO_JP6(){ 
# $1=gpo_id $2=gpo_value
    PIN=$1
    sudo pkill -f -- "$(sudo gpiofind $PIN)"
    sudo gpioset -m signal $(sudo gpiofind $PIN)=$2 &
}


function resetBTB {
    pin=$1
    pinA=$2
    setGPO_JP6 $2 0 
    sleep 1
    setGPO_JP6 $2 1 
}

function disableBTB {
    pin=$1
    pinA=$2
    setGPO_JP6 $2 0 
    sleep 0.3 
}

function initMAX9295 {
    from=$1
    to=$2

    # Move Address
    i2ctransfer -f -y 2 w3@$from 0x00 0x00 $(($to*2))
    i2ctransfer -f -y 2 w3@$to   0x00 0x01 0x28
}



function initMAX9296 {

    from=$1
    to=$2

    # Move Address
    sudo i2ctransfer -f -y 2 w3@$from 0x00 0x00 $(($to*2))

    sleep 0.05

    # Disable MIPI
    #i2ctransfer -f -y 2 w3@$to 0x03 0x13 0x00
    #sleep 0.1


    # Disable UART . with Pin swapped
    i2ctransfer -f -y 2 w3@$to 0x00 0x03 0x40
    # sleep 0.1
    sleep 0.05

    # Setting (GMSL2) Speed 187.5M / 6G
    i2ctransfer -f -y 2 w3@$to 0x00 0x01 0x02
    # sleep 0.1
    sleep 1
   
}


function reset20086-1 {
    setGPO_JP6 PJ.01 0
    sleep 1
    setGPO_JP6 PJ.01 1
    # reset power power off gmsl link 
    i2cset -f -y 2 0x28 0x01 0x10
    sleep 1
    # 20086 (BIT0 / BIT1)-->(PortA / Port B) -->POWER ON/OFF
     i2cset -f -y 2 0x28 0x01 0x1f
     sleep 1
}

function reset20086-2 {
    setGPO_JP6 PJ.02 0
    sleep 1
    setGPO_JP6 PJ.02 1 
    # reset power power off gmsl link 
    i2cset -f -y 2 0x29 0x01 0x10
    sleep 1
    # 20086 (BIT0 / BIT1)-->(PortA / Port B) -->POWER ON/OFF
      i2cset -f -y 2 0x29 0x01 0x1f
      sleep 1
}



BTB_A=344
BTB_B=345
BTB_C=341
BTB_D=480



BTB_AA=PEE.05
BTB_BA=PEE.06
BTB_CA=PEE.02
BTB_DA=PZ.02


MAX9296_A=0x48
MAX9296_B=0x4A
MAX9296_C=0x68
MAX9296_D=0x6C

MAX9295_PRIM=0x62
MAX9295_A=0x63
MAX9295_B=0x64
MAX9295_C=0x65
MAX9295_D=0x66


#MAX9296 0x48 0x4A 0x 68 0x6C
#MAX9295  0x62 -> 0x63 0x64 0x65 0x66


reset20086-1 
reset20086-2

disableBTB   $BTB_D  $BTB_DA
disableBTB   $BTB_C  $BTB_CA
disableBTB   $BTB_B  $BTB_BA
disableBTB   $BTB_A  $BTB_AA

echo 2. Init Channel3@CH02
# BTB_A
resetBTB $BTB_D $BTB_DA
initMAX9296 $MAX9296_A  $MAX9296_D
sleep 1
i2cget -f -y 2 $MAX9295_PRIM 0x00 2>/dev/null
ret="$?"
if [ $ret -eq 0 ]; then
    initMAX9295 $MAX9295_PRIM  $MAX9295_D
    echo "CAMERA 3 detected" 
fi 

echo 3. Init Channel3@CH13
# BTB_A
resetBTB $BTB_C $BTB_CA
initMAX9296 $MAX9296_A  $MAX9296_C
sleep 1
i2cget -f -y 2 $MAX9295_PRIM 0x00 2>/dev/null
ret="$?"
if [ $ret -eq 0 ]; then
    initMAX9295 $MAX9295_PRIM  $MAX9295_C
    echo "CAMERA 2 detected" 
fi 

echo 4. Init Channel3@CH46
# BTB_A
resetBTB $BTB_B $BTB_BA
initMAX9296 $MAX9296_A  $MAX9296_B
sleep 1
i2cget -f -y 2 $MAX9295_PRIM 0x00 2>/dev/null
ret="$?"
if [ $ret -eq 0 ]; then
    initMAX9295 $MAX9295_PRIM  $MAX9295_B
    echo "CAMERA 1 detected" 
fi 

echo 5. Init Channel0@CH57
# BTB_A
resetBTB $BTB_A  $BTB_AA
initMAX9296 $MAX9296_A  $MAX9296_A
sleep 1
i2cget -f -y 2 $MAX9295_PRIM 0x00 2>/dev/null
ret="$?"
if [ $ret -eq 0 ]; then
    initMAX9295 $MAX9295_PRIM  $MAX9295_A
    echo "CAMERA 0 detected" 
fi 

insmod sl_max9296.ko
insmod sl_max9295.ko
insmod sl_zedx.ko
insmod sl_zedxpro.ko
insmod sl_zedxone_uhd.ko
ZED_Explorer
