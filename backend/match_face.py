import face_recognition
import json
import numpy as np

def match_face(image_path, threshold=0.6):
    with open("known_faces.json", "r") as f:
        known_faces = json.load(f)

    known_encodings = [np.array(face["encoding"]) for face in known_faces]
    known_names = [face["name"] for face in known_faces]

    # Load new image
    image = face_recognition.load_image_file(image_path)
    new_encodings = face_recognition.face_encodings(image)

    if not new_encodings:
        print("❌ No face found in uploaded image.")
        return

    new_encoding = new_encodings[0]

    # Compare to known faces
    distances = face_recognition.face_distance(known_encodings, new_encoding)
    best_match_index = np.argmin(distances)

    if distances[best_match_index] <= threshold:
        matched_name = known_names[best_match_index]
        print(f"✅ Match found: {matched_name} (distance = {distances[best_match_index]:.2f})")
    else:
        print("❌ No match found.")

# 🧪 Run the function
if __name__ == "__main__":
    match_face("obama.jpg")  # Try the same image or a new one with the same face