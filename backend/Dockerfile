# Use an official Python image as the base image
FROM python:3.12

# Set the working directory inside the container
WORKDIR /app

RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx \
    libglib2.0-0 \
    protobuf-compiler \
    libprotobuf-dev \
    libssl-dev \
    cmake \
    && rm -rf /var/lib/apt/lists/*  # Clean up to reduce image size


# Copy the requirements file and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip  
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application files
COPY . .

# Expose the Flask API port
EXPOSE 5000

# Run the Flask API
CMD ["python", "app.py"]
