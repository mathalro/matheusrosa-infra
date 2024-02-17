#!/bin/bash

# Update linux packages
sudo yum update -y

# Install utilities
sudo yum -y install jq

# Constants
REGION=$(curl -s http://169.254.169.254/latest/dynamic/instance-identity/document | jq -r '.region')

# Install docker dependencies
sudo yum install -y docker
sudo service docker start
sudo curl -L https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m) -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
sudo usermod -a -G docker ec2-user

# Getting credentials from Secrets Manager
SECRECT_JSON=$(aws --region $REGION secretsmanager get-secret-value --secret-id matheusrosa-prod | jq -r '.SecretString')
TOKEN=$(echo $SECRECT_JSON | jq -r '."ghcr-token"')

# Download latest docker image
echo "Using token: $TOKEN to login in ghcr.io"
docker login ghcr.io -u mathalro -p $TOKEN
docker pull ghcr.io/mathalro/matheusrosa-website/website
docker pull ghcr.io/mathalro/matheusrosa-website/api
docker pull ghcr.io/mathalro/matheusrosa-website/nginx

# Download docker-compose-prod from github
sudo yum -y install git
git clone https://github.com/mathalro/matheusrosa-website.git
cd matheusrosa-website
docker-compose -f docker-compose.prod.yml up -d

# Configure CW logs
sudo yum install -y awslogs
sudo sed -i s/us-east-1/eu-west-1/ /etc/awslogs/awscli.conf

sudo echo "[application-api.log]
datetime_format = %b %d %H:%M:%S
file = ~/appdata/logs/application-api.log
buffer_duration = 5000
log_stream_name = {instance_id}
initial_position = start_of_file
log_group_name = ~/appdata/logs/application-api.log" >> /etc/awslogs/awslogs.conf

sudo systemctl start awslogsd
sudo systemctl enable awslogsd.service