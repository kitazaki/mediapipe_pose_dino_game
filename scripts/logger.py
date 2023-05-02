from flask import Flask, redirect, url_for, request
import json
app = Flask(__name__)
import pyautogui as pgui

@app.after_request
def add_headers(response):
    response.headers.add('Content-Type', 'application/json')
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Methods', 'PUT, GET, POST, DELETE, OPTIONS')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Expose-Headers', 'Content-Type,Content-Length,Authorization,X-Pagination')
    return response

@app.route('/logger',methods = ['POST'])
def main():
    data = request.get_json()
    print("data:", data)
    pgui.typewrite(' ')
    return "success"

if __name__ == '__main__':
    app.run(debug = True)
