#!/bin/bash
sudo cp Image /boot
sudo cp nru230*.dtb /boot/dtb
sudo cp *.isp /var/nvidia/nvcam/settings

ret=$(sudo i2ctransfer -f -y 0 w1@0x50 0x21 r1)
if [ "$ret" = "0x34" ];
then
sudo sed -i $'/INITRD \/boot\/initrd/{a   FDT \/boot\/dtb\/nru230-jao32.dtb\n:a;n;ba}' /boot/extlinux/extlinux.conf
else 
sudo sed -i $'/INITRD \/boot\/initrd/{a    FDT \/boot\/dtb\/nru230-jao64.dtb\n:a;n;ba}' /boot/extlinux/extlinux.conf
fi
cp ZedXDemo.desktop /home/nvidia/Desktop
chmod +x ./zedx.sh
 

