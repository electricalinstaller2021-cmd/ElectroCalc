const ALLOWED_ORIGIN =
  "https://electricalinstaller2021-cmd.github.io";

function corsHeaders(origin) {
  const allowed = origin === ALLOWED_ORIGIN;

  return {
    "Access-Control-Allow-Origin": allowed
      ? origin
      : ALLOWED_ORIGIN,
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

    // =====================================================
    // CORS PREFLIGHT
    // =====================================================
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(origin)
      });
    }

    const url = new URL(request.url);

    // =====================================================
    // HEALTH CHECK
    // =====================================================
    if (
      url.pathname === "/health" &&
      request.method === "GET"
    ) {
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

    // =====================================================
    // ELECTRO AI
    // =====================================================
    if (
      url.pathname === "/api/chat" &&
      request.method === "POST"
    ) {
      try {
        // -------------------------------------------------
        // CHECK API KEY
        // -------------------------------------------------
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

        // -------------------------------------------------
        // READ REQUEST BODY
        // -------------------------------------------------
        const body = await request.json();

        const message = body?.message;
        const context = body?.context ?? {};

        if (
          !message ||
          typeof message !== "string"
        ) {
          return json(
            {
              error: "Pesan tidak boleh kosong."
            },
            400,
            origin
          );
        }

        // =================================================
        // ELECTRO AI SYSTEM PROMPT
        // =================================================
        const system = `
Kamu adalah ELECTRO AI, asisten engineering listrik
untuk aplikasi ElectroCalc Pro.

Gunakan konteks kalkulator yang diberikan pengguna.

Gunakan bahasa Indonesia yang praktis dan mudah dipahami teknisi.

==================================================
PRINSIP UTAMA
==================================================

Calculator menghitung.
AI menjelaskan.
Engineer memverifikasi.

==================================================
ATURAN DATA
==================================================

Jangan mengarang data yang tidak diberikan.

Bedakan dengan jelas:

1. Hasil kalkulator
2. Data katalog/master
3. Asumsi
4. Rekomendasi

Jika data tidak cukup, katakan secara jelas
data apa yang masih diperlukan.

Jangan mengubah hasil kalkulator hanya agar
hasilnya terlihat lebih masuk akal.

==================================================
SIZING KOMPONEN
==================================================

Untuk sizing:

- MCB
- MCCB
- Kontaktor
- Thermal Overload Relay
- Kabel
- Inverter/VFD
- Soft Starter
- Capacitor Bank
- Komponen listrik lainnya

selalu tekankan bahwa hasil harus diverifikasi
terhadap:

- Nameplate motor
- Datasheet pabrikan
- Metode instalasi
- Temperatur
- Kemampuan hubung singkat
- Koordinasi proteksi
- Standar yang berlaku

==================================================
MASTER CHINT
==================================================

Jika tersedia data Master CHINT di konteks kalkulator,
gunakan data tersebut sebagai referensi katalog.

Bedakan antara:

- Produk yang sudah diverifikasi
- Produk yang hanya berupa kandidat
- Produk yang belum diverifikasi

Jangan mengklaim produk yang belum diverifikasi
sebagai spesifikasi resmi.

Jika model CHINT tidak tersedia atau belum terverifikasi,
katakan demikian.

==================================================
RANGKAIAN MOTOR
==================================================

Untuk pertanyaan rangkaian:

Jelaskan secara praktis:

1. Fungsi setiap komponen
2. Aliran daya
3. Aliran kontrol
4. Urutan kerja
5. Kondisi start
6. Kondisi stop
7. Fungsi proteksi
8. Hal yang perlu diverifikasi teknisi

Jangan menyatakan sebuah rangkaian pasti aman
untuk langsung diwiring tanpa verifikasi teknisi.

==================================================
CAPACITOR BANK
==================================================

Jika membahas capacitor bank,
bedakan antara:

- Data nameplate
- Beban aktual
- kW aktual
- Power factor aktual
- Target PF
- Hasil perhitungan kalkulator

Jika data pengukuran aktual tidak tersedia,
jelaskan bahwa sizing berdasarkan data aktual
lebih baik diverifikasi dengan pengukuran beban.

==================================================
GAYA JAWABAN
==================================================

Jawab dalam bahasa Indonesia.

Gunakan format yang mudah dibaca teknisi.

Jika menjelaskan hasil:

HASIL:
...

PENJELASAN:
...

REKOMENDASI:
...

VERIFIKASI:
...

Jika pertanyaan sederhana, jangan membuat jawaban
terlalu panjang.

Jika pertanyaan teknis kompleks, jelaskan langkah
demi langkah.
`;

        // =================================================
        // COMBINE AI INPUT
        // =================================================
        const input = `
${system}

==================================================
DATA KALKULATOR ELECTROCALC PRO
==================================================

${JSON.stringify(context, null, 2)}

==================================================
PERTANYAAN USER
==================================================

${message}
`;

        // =================================================
        // CALL OPENAI RESPONSES API
        // =================================================
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
                env.OPENAI_MODEL ||
                "gpt-5.6-luna",

              input: input
            })
          }
        );

        // =================================================
        // READ OPENAI RESPONSE
        // =================================================
        const data = await response.json();

        // =================================================
        // OPENAI ERROR
        // =================================================
        if (!response.ok) {
          console.error(
            "OpenAI error:",
            JSON.stringify(data)
          );

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

        // =================================================
        // EXTRACT TEXT FROM RESPONSES API
        // =================================================
        const reply =
          Array.isArray(data?.output)
            ? data.output
                .flatMap((item) =>
                  Array.isArray(item?.content)
                    ? item.content
                    : []
                )
                .filter(
                  (part) =>
                    part?.type === "output_text" &&
                    typeof part?.text === "string"
                )
                .map((part) => part.text)
                .join("\n")
                .trim()
            : "";

        // =================================================
        // NO TEXT RETURNED
        // =================================================
        if (!reply) {
          console.error(
            "OpenAI tidak mengembalikan output_text:",
            JSON.stringify(data)
          );

          return json(
            {
              error:
                "OpenAI tidak mengembalikan teks."
            },
            502,
            origin
          );
        }

        // =================================================
        // SUCCESS
        // =================================================
        return json(
          {
            reply: reply
          },
          200,
          origin
        );

      } catch (error) {
        // =================================================
        // GENERAL ERROR
        // =================================================
        console.error(
          "Worker error:",
          error
        );

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

    // =====================================================
    // UNKNOWN ENDPOINT
    // =====================================================
    return json(
      {
        error: "Endpoint tidak ditemukan."
      },
      404,
      origin
    );
  }
};
