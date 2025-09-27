# syntax=docker/dockerfile:1

FROM python:3.11-slim
ENV PYTHONUNBUFFERED=1
WORKDIR /simulator

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV SIMULATOR_REGION="誠軒"
ENV SIMULATOR_SERVER_URL="http://backend:3000"

CMD ["python", "start_all_dormitories.py", "--auto"]
