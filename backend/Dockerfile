FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    SEED_ON_STARTUP=true

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

# Fresh clone: migrate DB → seed demo data → start API. No manual steps.
CMD ["sh", "-c", "alembic upgrade head && if [ \"${SEED_ON_STARTUP}\" = \"true\" ]; then python -m app.seed; fi && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
