#!/bin/bash
yum update -y
sudo su

amazon-linux-extras install -y nginx1
systemctl start nginx
systemctl enable nginx

chmod 2775 /usr/share/nginx/html
find /usr/share/nginx/html -type d -exec chmod 2775 {} \;
find /usr/share/nginx/html -type f -exec chmod 0664 {} \;

echo "<h1>Website Currently in development</h1>" > /usr/share/nginx/html/index.html

sudo yum update -y
sudo yum install -y docker
sudo service docker start
sudo curl -L https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m) -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
sudo usermod -a -G docker ec2-user