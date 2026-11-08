
import os
import base64
import re
from pathlib import Path

from flask import Flask, request, jsonify, render_template
from dotenv import load_dotenv
from google import genai


# ======================================
# KONFIGURASI PROYEK
# ======================================

BASE_DIR = Path(__file__).resolve().parent

load_dotenv(BASE_DIR / ".env", override=True)

API_KEY = os.getenv("GEMINI_API_KEY")

if not API_KEY or not API_KEY.strip():
    print("ERROR: GEMINI_API_KEY kosong atau tidak ditemukan!")
    client = None
else:
    API_KEY = API_KEY.strip()
    print("API Key Gemini berhasil dibaca!")
    client = genai.Client(api_key=API_KEY)

app = Flask(__name__)


# ======================================
# MEMBACA FOTO DAN INFORMASI PRODUK
# ======================================

def build_gemini_contents(prompt, data):

    contents = [prompt]

    image_data = data.get("product_image") or ""

    if image_data:

        match = re.match(
            r"^data:(image/(?:png|jpeg));base64,(.+)$",
            image_data,
            re.DOTALL
        )

        if not match:
            raise ValueError("Format gambar tidak valid.")

        mime_type = match.group(1)
        encoded_image = match.group(2)

        image_bytes = base64.b64decode(
            encoded_image,
            validate=True
        )

        if len(image_bytes) > 5 * 1024 * 1024:
            raise ValueError("Ukuran gambar maksimal 5 MB.")

        contents.append(
            genai.types.Part.from_bytes(
                data=image_bytes,
                mime_type=mime_type
            )
        )

    product_name = (data.get("product_name") or "").strip()
    product_description = (
        data.get("product_description") or ""
    ).strip()

    if product_name or product_description:

        contents.append(
            f"""
Informasi produk dari pengguna:

Nama produk: {product_name or "Tidak disebutkan"}

Deskripsi produk:
{product_description or "Tidak disebutkan"}
"""
        )

    return contents


# ======================================
# HALAMAN UTAMA
# ======================================

@app.route("/")
def home():
    return render_template("index.html")


# ======================================
# GENERATOR CAPTION AI
# ======================================

@app.route("/api/generate-caption", methods=["POST"])
def generate_caption():

    if not client:
        return jsonify({
            "error": "API Key Gemini belum ditemukan. Periksa file .env."
        }), 500

    data = request.get_json(silent=True) or {}

    nama = (data.get("nama") or "").strip()
    deskripsi = (data.get("deskripsi") or "").strip()
    harga = (data.get("harga") or "").strip()
    target = (data.get("target") or "").strip()
    gaya = (data.get("gaya") or "ceria").strip()

    product_name = (data.get("product_name") or "").strip()
    product_description = (
        data.get("product_description") or ""
    ).strip()
    product_image = data.get("product_image") or ""

    nama = nama or product_name
    deskripsi = deskripsi or product_description

    if not nama and not deskripsi and not product_image:
        return jsonify({
            "error": "Masukkan informasi atau foto produk terlebih dahulu."
        }), 400

    prompt = f"""
Kamu adalah ahli digital marketing untuk UMKM Indonesia.

Buatkan caption promosi media sosial yang menarik,
singkat, kreatif, dan siap dipublikasikan.

Nama produk: {nama or "Analisis dari foto produk"}
Deskripsi: {deskripsi or "Analisis dari foto produk"}
Harga: {harga or "Tidak dicantumkan"}
Target konsumen: {target or "Umum"}
Gaya bahasa: {gaya}

Jika terdapat foto produk, amati foto tersebut untuk
memahami jenis dan tampilan produknya.

Ketentuan:
- Gunakan bahasa Indonesia.
- Buat caption yang ringkas dan menarik.
- Sertakan ajakan membeli (Call to Action).
- Tambahkan hashtag yang relevan.
- Jangan mengarang harga, diskon, atau klaim produk.
- Berikan hanya hasil caption.
"""

    try:

        response = client.models.generate_content(
            model="gemini-3.8-flash",
            contents=build_gemini_contents(prompt, data)
        )

        caption = response.text

        if not caption:
            raise ValueError("Gemini tidak menghasilkan caption.")

        return jsonify({
            "caption": caption
        })

    except Exception as e:

        print("Gemini Caption Error:", repr(e))

        return jsonify({
            "error": str(e)
        }), 500


# ======================================
# GENERATOR IDE KONTEN
# ======================================

@app.route("/api/generate-ideas", methods=["POST"])
def generate_ideas():

    if not client:
        return jsonify({
            "error": "API Key Gemini belum ditemukan."
        }), 500

    data = request.get_json(silent=True) or {}

    tema = (data.get("tema") or "").strip()
    platform = (data.get("platform") or "").strip()
    target = (data.get("target") or "Umum").strip()
    gaya = (data.get("gaya") or "Kreatif").strip()

    product_name = (data.get("product_name") or "").strip()
    product_description = (
        data.get("product_description") or ""
    ).strip()
    product_image = data.get("product_image") or ""

    tema = tema or product_name

    if not tema and not product_description and not product_image:
        return jsonify({
            "error": "Masukkan tema atau informasi produk terlebih dahulu."
        }), 400

    if not platform:
        return jsonify({
            "error": "Platform media sosial wajib diisi."
        }), 400

    prompt = f"""
Kamu adalah ahli strategi konten media sosial.

Buatkan 5 ide konten promosi yang kreatif dan relevan.

Tema: {tema or "Sesuaikan dengan foto produk"}
Platform: {platform}
Target konsumen: {target}
Gaya konten: {gaya}

Jika ada foto produk, gunakan foto tersebut untuk memahami
produk dan menyesuaikan ide konten.

Untuk setiap ide, tampilkan:

1. Judul ide konten.
2. Format konten (Reels, Carousel, atau Story).
3. Arahan isi (maksimal 1-2 kalimat).
4. Tujuan konten (singkat).

Ketentuan:
- Gunakan bahasa Indonesia.
- Buat 5 ide yang berbeda.
- Sesuaikan dengan platform.
- Jangan mengarang klaim produk.
- Hindari pembukaan panjang.
- Jawaban harus ringkas dan jelas.
"""

    try:

        response = client.models.generate_content(
            model="gemini-3.8-flash",
            contents=build_gemini_contents(prompt, data),
            config=genai.types.GenerateContentConfig(
                max_output_tokens=900,
                temperature=0.7
            )
        )

        ideas = response.text

        if not ideas:
            raise ValueError("Gemini tidak menghasilkan ide.")

        return jsonify({
            "ideas": ideas
        })

    except Exception as e:

        print("Gemini Ideas Error:", repr(e))

        return jsonify({
            "error": str(e)
        }), 500


# ======================================
# CONTENT PLANNER
# ======================================

@app.route("/api/generate-plan", methods=["POST"])
def generate_plan():

    if not client:
        return jsonify({
            "error": "API Key Gemini belum ditemukan."
        }), 500

    data = request.get_json(silent=True) or {}

    tema = (data.get("tema") or "").strip()
    platform = (data.get("platform") or "").strip()
    durasi = data.get("durasi")

    product_name = (data.get("product_name") or "").strip()
    product_description = (
        data.get("product_description") or ""
    ).strip()
    product_image = data.get("product_image") or ""

    tema = tema or product_name

    if not tema and not product_description and not product_image:
        return jsonify({
            "error": "Masukkan tema atau informasi produk terlebih dahulu."
        }), 400

    if not platform:
        return jsonify({
            "error": "Platform media sosial wajib diisi."
        }), 400

    try:
        durasi = int(durasi)
    except (TypeError, ValueError):
        return jsonify({
            "error": "Durasi tidak valid."
        }), 400

    if durasi not in [7, 14, 30]:
        return jsonify({
            "error": "Durasi hanya boleh 7, 14, atau 30 hari."
        }), 400

    prompt = f"""
Kamu adalah ahli social media content strategist.

Buatkan Content Planner selama {durasi} hari.

Tema konten: {tema or "Sesuaikan dengan foto produk"}
Platform publikasi: {platform}

Jika ada foto produk, gunakan informasi visualnya
untuk menyesuaikan seluruh jadwal konten.

Ketentuan:
- Gunakan bahasa Indonesia.
- Buat tepat {durasi} hari.
- Setiap hari memiliki ide yang berbeda.
- Sesuaikan ide dengan tema dan platform.
- Setiap hari berisi:
  1. Hari
  2. Ide konten
  3. Format konten
  4. Arahan singkat isi konten
  5. Tujuan konten
- Jangan mengarang klaim produk.
- Hindari pembukaan panjang.
- Jawaban harus ringkas dan terstruktur.

Gunakan format:

HARI 1
Ide Konten:
Format:
Arahan:
Tujuan:

Lanjutkan sampai HARI {durasi}.
"""

    try:

        response = client.models.generate_content(
            model="gemini-3.8-flash",
            contents=build_gemini_contents(prompt, data),
            config=genai.types.GenerateContentConfig(
                max_output_tokens=durasi * 180,
                temperature=0.7
            )
        )

        plan = response.text

        if not plan:
            raise ValueError("Gemini tidak menghasilkan jadwal.")

        return jsonify({
            "plan": plan
        })

    except Exception as e:

        print("Gemini Planner Error:", repr(e))

        return jsonify({
            "error": str(e)
        }), 500


# ======================================
# MENJALANKAN SERVER
# ======================================

if __name__ == "__main__":

    print("Menjalankan server PromoAI...")

    port = int(os.environ.get("PORT", 5000))

    app.run(
        host="0.0.0.0",
        port=port,
        debug=False
    )