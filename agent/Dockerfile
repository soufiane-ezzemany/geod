FROM python:3.11-slim-bookworm
WORKDIR /app
COPY requirements.txt .
# Install system dependencies: iproute2 for 'tc', iperf3 for experiments, iputils-ping for ping, traceroute, iptables for packet marking
RUN apt-get update && apt-get install -y iproute2 iperf3 iputils-ping traceroute iptables && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
# Agent will be run with 'command' in docker-compose, no CMD here.
# privileged mode is set in docker-compose for tc
