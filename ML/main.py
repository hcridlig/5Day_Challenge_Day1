from ultralytics import YOLO
from multiprocessing import freeze_support

def main():
    # Load a model
    model = YOLO("yolo11n.pt")

    # Train the model
    train_results = model.train(
        data="datasets/data.yaml",  # path to dataset YAML
        epochs=100,  # number of training epochs
        imgsz=640,  # training image size
        # device="cpu",  # Uncomment this line if you want to use CPU
    )

    # Evaluate model performance on the validation set
    metrics = model.val()

    # Perform object detection on an image
    #results = model("iphone.jpg")
    #results[0].show()

    # Export the model to ONNX format
    path = model.export(format="onnx")  # return path to exported model

if __name__ == "__main__":
    freeze_support()  # Required for Windows multiprocessing
    main()
