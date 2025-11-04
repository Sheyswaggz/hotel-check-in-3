# Build production image
docker build -t hotel-checkin:latest .

# Build with specific tag
docker build -t hotel-checkin:v1.0.0 .

# Build with build arguments
docker build --build-arg NODE_ENV=production -t hotel-checkin:latest .