import face_recognition
import json
import os

def save_face_encoding(image_path, label):
    image = face_recognition.load_image_file(image_path)
    encodings = face_recognition.face_encodings(image)

    if not encodings:
        print("❌ No face found in the image.")
        return

    encoding = encodings[0]

    # Load or create known_faces.json
    if os.path.exists("known_faces.json"):
        with open("known_faces.json", "r") as f:
            known_faces = json.load(f)
    else:
        known_faces = []

    # Add this new face
    known_faces.append({
        "name": label,
        "encoding": encoding.tolist()  # NumPy array -> list
    })

    # Save back to JSON
    with open("known_faces.json", "w") as f:
        json.dump(known_faces, f)

    print(f"✅ Saved face for '{label}'.")

# 🧪 Run the function
if __name__ == "__main__":
    save_face_encoding("obama.jpg", "Obama")

