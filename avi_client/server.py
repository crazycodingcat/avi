from flask import request, Flask, redirect, url_for, render_template
import json
from werkzeug import secure_filename

from skimage import io, img_as_ubyte
import numpy as np 
import os, json, uuid
from datetime import datetime 
from glob import glob

from defect_classifier import AVIClassifier


app = Flask(__name__)

canvas_width = 600
canvas_height = 600

avi_classifier = AVIClassifier()

DEFECT_DICT = {"RS": "Rolled-in scale", "Pa": "Patches", "Cr": "Crazing", "PS": "Pitted surface", "Sc": "Scraches", "In": "Inclusion"}

DEFECT_TYPES = map(DEFECT_DICT.get, list(avi_classifier.class_names())) + ["custom type"]

# DEFECT_TYPES = list(avi_classifier.class_names()) + ["custom type"]
UPLOAD_FOLDER = "static/upload/"
DATA_STORE = "static/data/"
IMAGE_PATCH_STORE = "static/data/patches"
META_STORE = "static/data/patches.json"
META_HEADER = ["time", "image_id", "patch_id", "row", "col", "nr", "nc", "defect", "byhuman"]
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)
if not os.path.exists(DATA_STORE):
    os.makedirs(DATA_STORE)
if not os.path.exists(IMAGE_PATCH_STORE):
    os.makedirs(IMAGE_PATCH_STORE)
if not os.path.exists(META_STORE):
    meta = {}
else:
    meta = json.load(open(META_STORE))


@app.route('/upload', methods=["POST"])
def upload():
    uploaded_files = request.files.getlist('image-file')
    file_list = []
    # print uploaded_files
    for uploaded_file in uploaded_files:
        filename = secure_filename(uploaded_file.filename)
        uploaded_file_path = os.path.join(UPLOAD_FOLDER, filename)
        try:
            #save file to disk
            print "hello"
            print uploaded_file_path
            uploaded_file.save(uploaded_file_path)
            file_list.append({"url": uploaded_file_path, "fileName": filename})
        except Exception, e:
            print "Image %s already exists" %filename
            raise
    return json.dumps(file_list)

@app.route("/get_gallery", methods=["GET"])
def get_gallery():
    img_files = glob("%s/*" % UPLOAD_FOLDER)
    return json.dumps([{"url": f, 
                        "fileName": os.path.basename(f)} for f in img_files])
            

@app.route("/", methods=["GET"])
def analyze():
    image_id = request.args.get("image_id", "")
    image_description = request.args.get("image_description", "")
    return render_template("index.html", defect_types = DEFECT_TYPES)
    # return render_template("index.html",
    #   canvas_width = canvas_width, canvas_height = canvas_height,
    #   image_id = image_id, defect_types = DEFECT_TYPES, image_description=image_description)

@app.route("/analyze-roi", methods=["POST"])
def analyze_roi():
    image_id = request.form["image_id"]
    row = int(request.form["row"])
    col = int(request.form["col"])
    nr = int(request.form["nr"])
    nc = int(request.form["nc"])
    
    img = io.imread(os.path.join(UPLOAD_FOLDER, image_id))
    print "analyze ROI", row, col, nr, nc, image_id
    if len(img.shape) == 2:
        img_patch = img[row:(row+nr), col:(col+nc)]
    else:
        img_patch = img[row:(row+nr), col:(col+nc), :]
    
    patch_id = "%s_%s" % (uuid.uuid4(), image_id)
    print "patch_id:", patch_id
    io.imsave(os.path.join(IMAGE_PATCH_STORE, patch_id), img_patch)

    defects = avi_classifier.predict(img_patch)
    
    return json.dumps({"defects": [{"type": DEFECT_DICT[defect[0]], "probability": defect[1]} for defect in defects[:3]]
                        , "patch_id": patch_id})

    # ############ dummy results generator ################
    # p = random.random()

    # return json.dumps({"defects": [{"type": "sc", "probability": p}, {"type": "ps", "probability": (1-p)/2}, 
    #   {"type": "ab", "probability": (1-p)/2}]
    #   , "patch_id": patch_id})
    # ############ dummy results generator ################


@app.route("/patches", methods=["GET"])
def view_patches():
    headers = ["patch"] + META_HEADER
    patches = [[row[f] for f in META_HEADER] for row in sorted(meta.values(),key=lambda x:x['time'])]
    print meta
    return render_template("patches.html", headers = headers, patches = patches)

@app.route("/feedback", methods=["POST"])
def feedback():
    time = str(datetime.now())[:19]
    patch_id = request.form["patch_id"]
    defect = request.form["defect_type"]
    image_id = request.form["image_id"]
    row = int(request.form["row"])
    col = int(request.form["col"])
    nr = int(request.form["nr"])
    nc = int(request.form["nc"])
    byhuman = request.form["byhuman"]
    meta[patch_id] = dict(zip(META_HEADER, [time, image_id, patch_id, row, col, nr, nc, defect, byhuman]))
    json.dump(meta, open(META_STORE, "w"))
    return json.dumps({"patch_id": patch_id, "defect_type": defect})


if __name__ == '__main__':
    # app.run(debug = True, port = 5001)
    app.run(debug = True, port = 5000, host = "0.0.0.0")