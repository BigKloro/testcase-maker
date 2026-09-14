import type { GenerateRequest } from "./types";

// Sanitised samples. Never paste real client requirements into the public demo.
export const SAMPLES: { label: string; req: GenerateRequest }[] = [
  {
    label: "PEGA core banking (id)",
    req: {
      requirement_text:
        "Tambahkan tombol 'Cek Limit dan Akad SIKP' pada Step 1 halaman Initial Application Terms untuk pengajuan produk KUR. Tombol mengirim parameter Nik, Skema, dan Sektor ke service SIKP. Jika response Code = '00', tampilkan modal 'get_limit_sikp' berisi field NIK, Skema, Sektor, Kel_Sektor, Count_akad, Count_akad_ini, lalu aktifkan tombol 'Hitung Angsuran'. Jika Code != '00', tampilkan modal error dengan keterangan 'Error Pada Saat Get Limit dan Akad SIKP' dan tombol 'Hitung Angsuran' tetap disabled. Setiap response disimpan ke tabel trx_sikp_response dengan CreatedBy = 'Response_Cek_Limit_Dan_Akad'. Validasi wajib klik 'Cek Limit dan akad' aktif kembali setiap pengguna masuk ke Step 1. Tombol tidak berlaku untuk produk KUK.",
      system_under_test: "PEGA",
      story_key: "DEMO-5385",
      story_title: "Pega Micro - Mapping Bunga Graduasi (Solusi Sementara SIKP)",
      story_url: "https://example.atlassian.net/browse/DEMO-5385",
      language: "id",
      req_prefix: "TC-01",
      target_case_count: 10,
      default_priority: "High",
      default_type: "Functional",
      include_rtm: true,
    },
  },
  {
    label: "REST API (en)",
    req: {
      requirement_text:
        "As a mobile banking user I can transfer funds between my own accounts via POST /v1/transfers. Request body: source_account, destination_account, amount (IDR, integer, minimum 10000, maximum 50000000 per transaction), note (optional, max 40 chars). Both accounts must belong to the authenticated customer, otherwise respond 403 with code OWNERSHIP_MISMATCH. Insufficient balance responds 422 with code INSUFFICIENT_FUNDS. Daily cumulative limit is 100000000; exceeding it responds 422 with code DAILY_LIMIT_EXCEEDED. On success respond 201 with transfer_id, status 'COMPLETED', and the new balance of the source account; the transfer must appear in GET /v1/accounts/{id}/transactions for both accounts within 5 seconds. Requests without a valid bearer token respond 401.",
      system_under_test: "REST API",
      story_key: "MB-2210",
      story_title: "Own-account transfer API",
      story_url: null,
      language: "en",
      req_prefix: "TC-01",
      target_case_count: 14,
      default_priority: "High",
      default_type: "Functional",
      include_rtm: true,
    },
  },
];

export const EMPTY: GenerateRequest = {
  requirement_text: "",
  system_under_test: "PEGA",
  story_key: "",
  story_title: "",
  story_url: "",
  language: "id",
  req_prefix: "TC-01",
  target_case_count: null,
  default_priority: "High",
  default_type: "Functional",
  include_rtm: true,
};
