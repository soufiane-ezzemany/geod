FROM python:3.11-slim
WORKDIR /app
RUN pip install flask redis
COPY app.py .
RUN apt-get update && apt-get install -y iproute2 && rm -rf /var/lib/apt/lists/*
CMD ["python", "app.py"]
