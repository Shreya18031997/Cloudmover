import face_recognition
import json
import numpy as np
import os

def match_face(image_path, threshold=0.6):
    if not os.path.exists("known_faces.json"):
        print("❌ No known faces to compare with.")
        return

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

    distances = face_recognition.face_distance(known_encodings, new_encoding)
    best_index = np.argmin(distances)

    if distances[best_index] <= threshold:
        matched_name = known_names[best_index]
        print(f"✅ Match found: {matched_name} (distance = {distances[best_index]:.2f})")

        # Save to match history
        match_record = {
            "filename": image_path,
            "matched_name": matched_name
        }

        if os.path.exists("tagged_faces.json"):
            with open("tagged_faces.json", "r") as f:
                match_history = json.load(f)
        else:
            match_history = []

        match_history.append(match_record)

        with open("tagged_faces.json", "w") as f:
            json.dump(match_history, f, indent=2)

    else:
        print("❌ No match found.")

# 🧪 Run the function
if __name__ == "__main__":
    match_face("obama.jpg")  # Replace with your test image


    


