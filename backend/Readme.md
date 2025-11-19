# Geod Backend

The Geod backend is built using Flask, a lightweight web framework for Python. This README provides instructions on how to set up and run the backend application.

## Setup requiremnts

Make sure you have Python 3.7 or higher installed on your machine. And that your are in the `backend/` directory.

## Setup instructions

First create a virtual environment:

```bash
python3 -m venv venv
```

Or:

```bash
python -m venv venv
```

Then activate the virtual environment:

```bash
# Linux/macOS
source venv/bin/activate
```

```bash
# Windows
venv\Scripts\activate
```

Then install the required packages:

```bash
pip install -r requirements.txt
```

Finally, run the Flask app:

```bash
python app.py
```

The application should be accessible at `http://127.0.0.1:5000/`
