const ALLOWED_ORIGIN =
  "https://electricalinstaller2021-cmd.github.io";

function corsHeaders(origin) {
  const allowed = origin === ALLOWED_ORIGIN;

  return {
    "Access-Control-Allow-Origin": allowed ? origin : ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json; charset=UTF-8"
  };
}

function json(data, status = 200, origin = "") {
  return new Response(JSON.stringify(data), {
    status,
    headers: corsHeaders(origin)
  });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(origin)
      });
    }

    const url = new URL(request.url);

    // =========================
    // HEALTH CHECK
    // =========================
    if (url.pathname === "/health" && request.method === "GET") {
      return json(
        {
          ok: true,
          service: "Electro AI",
          status: "online"
        },
        200,
        origin
      );
    }

    // =========================
    // ELECTRO AI
    // =========================
    if (url.pathname === "/api/chat" && request.method === "POST") {
      try {
        if (!env.OPENAI_API_KEY) {
          return json(
            {
              error:
                "OPENAI_API_KEY belum dikonfigurasi di Cloudflare."
            },
            500,
            origin
          );
        }

        const body = await request.json();

        const message = body?.message;
        const context = body?.context ?? {};

        if (!message || typeof message !== "string") {
          return json(
            {
              error: "Pesan tidak boleh kosong."
            },
            400,
            origin
          );
        }

        const system = `
Kamu adalah ELECTRO AI, asisten engineering listrik
untuk aplikasi ElectroCalc Pro.

Gunakan konteks kalkulator yang diberikan pengguna.

Gunakan bahasa Indonesia yang praktis dan mudah dipahami teknisi.

PRINSIP UTAMA:

Calculator menghitung.
AI menjelaskan.
Engineer memverifikasi.

Jangan mengarang data yang tidak diberikan.

Bedakan dengan jelas:

1. hasil kalkulator,
2. data katalog/master,
3. asumsi,
4. rekomendasi.

Untuk sizing:

- MCB
- MCCB
- kontaktor
- thermal overload relay
- kabel
- inverter
- capacitor bank
- komponen listrik lainnya

selalu tekankan verifikasi terhadap:

- nameplate motor
- datasheet pabrikan
- metode instalasi
- temperatur
- kemampuan hubung singkat
- koordinasi proteksi
- standar yang berlaku

Jika tersedia data Master CHINT,
gunakan data tersebut sebagai referensi katalog.

Jangan mengklaim produk yang belum diverifikasi
sebagai spesifikasi resmi.

Jangan mengubah hasil kalkulator hanya agar terlihat
lebih masuk akal.

Untuk pertanyaan rangkaian:

jelaskan fungsi komponen,
aliran daya,
aliran kontrol,
dan urutan kerja secara praktis.

Jangan menyatakan sebuah rangkaian pasti aman
untuk langsung diwiring tanpa verifikasi teknisi.

Jika data tidak cukup,
katakan data apa yang kurang.

Jawab dalam bahasa Indonesia.
`;

        const input = `
${system}

DATA KALKULATOR:
${JSON.stringify(context, null, 2)}

PERTANYAAN USER:
${message}
`;

        const response = await fetch(
          "https://api.openai.com/v1/responses",
          {
            method: "POST",

            headers: {
              "Content-Type": "application/json",
              "Authorization":
                `Bearer ${env.OPENAI_API_KEY}`
            },

            body: JSON.stringify({
              model:
                env.OPENAI_MODEL || "gpt-5.6-luna",

              input: input
            })
          }
        );

        const data = await response.json();

        if (!response.ok) {
          console.error("OpenAI error:", data);

          return json(
            {
              error:
                data?.error?.message ||
                "OpenAI gagal memproses permintaan."
            },
            response.status,
            origin
          );
        }

        return json(
          {
            reply:
              data?.output_text ||
              "AI tidak mengembalikan teks."
          },
          200,
          origin
        );

      } catch (error) {
        console.error("Worker error:", error);

        return json(
          {
            error:
              error?.message ||
              "Terjadi kesalahan pada Electro AI."
          },
          500,
          origin
        );
      }
    }

    return json(
      {
        error: "Endpoint tidak ditemukan."
      },
      404,
      origin
    );
  }
};
