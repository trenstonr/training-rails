# Training Rails

Automated rail defect detection platform.

**BeaverHacks 2026 - Hardware Track (Winner)**  
**Team:** Chris Ho, James Tappert, Konstantin Savkin, Trenston Ricks

Training Rails uses a train-mounted camera and a custom-trained YOLO computer vision model to detect rail defects, place them on an inspector dashboard, and send urgent SMS alerts when operator attention is needed.

Live Demo Slides: https://docs.google.com/presentation/d/1vxT7ZXQkkmtJf2FVLyoud-aa1qxplDshNgzcT0bAj2c/edit?usp=sharing

<p align="center">
  <img width="322" height="341" alt="Training Rails hardware setup" src="https://github.com/user-attachments/assets/044ef13e-0f75-40fd-bf00-9185cf360761" />
  <br>
  <em>NVIDIA Jetson TX2 + Logitech HD Pro Webcam C920 + Stratux GPS 2.0</em>
</p>

## Architecture

```text
┌──────────────┐     ┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│  YOLO Model  │───▶│    Edge     │─────▶│   Backend   │─────▶│  Frontend  │
│  (Trained)   │     │  (Jetson)   │      │  (FastAPI)  │      │ React/Vite  │
└──────────────┘     └─────────────┘      └─────────────┘      └─────────────┘
      │                    │                     │                    │
 Defect Detection     Camera + GPS        Supabase + SMS          leaflet.js
```

- **YOLO Model**: Custom-trained rail-defect detector for cracks, squats, flaking, and surface damage
- **Edge**: Jetson camera pipeline for capture, inference, upload, and live video streaming to the frontend through ngrok
- **Backend**: FastAPI service for image lookup, severity scoring, Supabase access, and SMS dispatch
- **Frontend**: React/Vite inspector dashboard with map pins, live video, and dispatch controls
- **Supabase**: Stores defect images and pin data
- **Twilio**: Sends urgent operator alerts

## Detection & Dispatch Flow

```text
1. Camera captures rail imagery from the moving platform
2. YOLO model detects possible defects such as cracks, squats, or flaking
3. Defect image is uploaded to Supabase Storage
4. Backend receives the image path and returns a severity score
5. Dashboard displays the defect as a map pin
6. Severe defects can be dispatched by SMS with coordinates and timestamp
```

## Computer Vision

Training Rails uses a custom-trained YOLO object detection model for rail defect recognition. The model identifies visual defects from camera frames so inspectors can review likely problem areas instead of manually scanning raw footage.

<p align="center">
<img width="368" height="358" alt="Screenshot 2026-05-03 181045" src="https://github.com/user-attachments/assets/af23c98d-b56e-41c0-9f38-d33a2d709a34" />
  <br>
  <em>Live Demo Model Output
</em>
</p>

## Core Features

- Train-mounted visual inspection pipeline
- Custom YOLO-based rail defect detection
- Supabase-backed image and detection storage
- Inspector dashboard with map-based defect pins
- Severity scoring for detected defects
- SMS dispatch alerts for urgent cases

## Key Backend Routes

| Route | Purpose |
| --- | --- |
| `POST /detect` | Score a Supabase defect image and return severity |
| `POST /dispatch` | Send one urgent SMS alert to the configured operator |

## Development

### Backend

```bash
cd backend
pip install -r requirements.txt
python run.py
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Jetson

```bash
cd jetson
python jetson_main.py
```

## Repository Layout

```text
backend/      FastAPI backend, Supabase image access, SMS dispatch
frontend/     React/Vite inspector dashboard
jetson/       Edge-device camera and inference pipeline
model/        YOLO model assets
supabase/     Supabase project files
```

## License

See [LICENSE](LICENSE).
