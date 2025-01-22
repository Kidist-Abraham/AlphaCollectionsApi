# Collections & Contributions Backend

This repository contains the **backend** for managing "Collections" and user contributions. The system can store contribution files either in **AWS S3** or locally on the server, based on an environment variable `ENABLE_S3`.

## Table of Contents

1. [Overview](#overview)  
2. [Environment Variables](#environment-variables)  
3. [Setup & Installation](#setup--installation)  

6. [Example Usage](#example-usage)

---

## 1. Overview

This backend allows **authenticated users** to create and manage “collections,” and upload files (contributions) to these collections. Depending on configuration, files are either:

- **Locally** stored in `./uploads/<collectionId>`
- **AWS S3**, under `<collectionId>/<userIdHash>/<timestamp_filename>`

Users can also **download a zip** of all contributions for a given collection. The code uses token-based authentication (JWT) so you must provide a valid token for most routes.

---

## 2. Environment Variables

Create a `.env` file in the project root with the following variables (example):

```bash
# PostgreSQL Environment Variables
POSTGRES_USER=dc_user
POSTGRES_PASSWORD=db_password
POSTGRES_DB=dc_db
POSTGRES_HOST=postgres
POSTGRES_PORT=5432

# Construct DATABASE_URL from the above variables
DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}

# JWT Secret
JWT_SECRET=your_jwt_secret

# AWS Credentials
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=your_aws_region
AWS_BUCKET_NAME=your_s3_bucket_name

# Storage
ENABLE_S3=false

```

Explanation

ENABLE_S3: true or false. If true, files go to S3; if false, they go to ./uploads. Set false, for testing purposes.

AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, AWS_BUCKET_NAME: Required only if ENABLE_S3=true, for storing files in your AWS S3 bucket.

JWT_SECRET: Secret key used for JWT-based authentication.

## 3. Setup & Installation

Clone the repo:

```bash

git clone https://github.com/your-username/collections-backend.git
cd collections-backend
```

Create and populate .env file (see [Environment Variables](#environment-variables) ).

Run docker compose:

```bash
 docker-compose up --build -d
```

The server listens on localhost PORT 3000.