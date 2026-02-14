from flask import Flask, jsonify
import redis
import time

app = Flask(__name__)
r = redis.Redis(host='redis', port=6379, decode_responses=True)

@app.route('/')
def index():
    return 'Demo Webapp'

@app.route('/ping-redis')
def ping_redis():
    start = time.time()
    r.ping()
    latency = (time.time() - start) * 1000
    return jsonify({'latency_ms': round(latency, 2)})

@app.route('/set/<key>/<value>')
def set_key(key, value):
    start = time.time()
    r.set(key, value)
    latency = (time.time() - start) * 1000
    return jsonify({'key': key, 'latency_ms': round(latency, 2)})

@app.route('/get/<key>')
def get_key(key):
    start = time.time()
    value = r.get(key)
    latency = (time.time() - start) * 1000
    return jsonify({'key': key, 'value': value, 'latency_ms': round(latency, 2)})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080)
