# Use official Python runtime as a parent image
FROM python:3.12-slim

# Set working directory
WORKDIR /app

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Install system dependencies
# gcc and libpq-dev are often needed for psycopg2 (PostgreSQL) and other libs
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies
RUN pip install --no-cache-dir uv

# copy dependency descriptors first for layer caching
COPY pyproject.toml uv.lock ./
# create venv + sync deps (no dev deps in production)
RUN uv sync --frozen --no-dev --no-install-project

# Copy project files
COPY . .

# Expose port
EXPOSE 8000
# Command to run the application
# Using shell form to allow variable expansion if needed, but array form is preferred
ENTRYPOINT ["/entrypoint.sh"]
CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
