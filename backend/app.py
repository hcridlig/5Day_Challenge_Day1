from flask import Flask, request, jsonify
from flask_cors import CORS
from ultralytics import YOLO
import cv2
import numpy as np
import base64
from io import BytesIO

app = Flask(__name__)
CORS(app)

# Load the YOLO model
model = YOLO("best.onnx", task="detect")  # Update path to your model file

# Helper function to decode base64 image
def decode_image(data):
    img_data = base64.b64decode(data.split(',')[1])
    np_arr = np.frombuffer(img_data, np.uint8)
    img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
    return img

@app.route('/api/detect', methods=['POST'])
def predict():
    try:
        # Get the image in base64 format from the POST request
        data = request.json
        img_data = data['image']
        
        # Decode the image
        img = decode_image(img_data)
        
        # Run YOLO inference
        results = model(img)
        
        # Get results as a base64 encoded string
        output_img = results[0].plot()  # Get the annotated image
        _, img_encoded = cv2.imencode('.jpg', output_img)
        img_base64 = base64.b64encode(img_encoded).decode('utf-8')

        return jsonify({'result': img_base64})

    except Exception as e:
        return jsonify({'error': str(e)})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=80)
