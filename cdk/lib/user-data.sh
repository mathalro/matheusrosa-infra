#!/bin/bash

# Update linux packages
sudo su
sudo yum update -y

# Install docker dependencies
yum install -y docker
service docker start
curl -L https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m) -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose
usermod -a -G docker ec2-user

# Download docker-compose-prod from github
yum -y install git
git clone https://github.com/mathalro/matheusrosa-website/tree/main
cd matheusrosa-website
