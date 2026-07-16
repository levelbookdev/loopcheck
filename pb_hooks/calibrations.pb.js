/// <reference path="../pb_data/types.d.ts" />
//
// Atomic calibration capture (ADR 0016).
//
// POST /api/calibrations/capture (multipart or form data)
//   tag, standard, technician, company, performed_at, interval_months,
//   result, notes, client_token, points_json, report?
//
// This route stays accountless like check capture: a field technician can use
// the QR workflow without an account. It is intentionally narrow and validates
// every value before bypassing the locked collection create rules.

routerAdd("POST", "/api/calibrations/capture", (e) => {
  try {
    const body = new DynamicModel({
      tag: "", standard: "", technician: "", company: "",
      performed_at: "", interval_months: 0, result: "", notes: "",
      client_token: "", points_json: "",
    });
    e.bindBody(body);

    if (!/^[a-z0-9-]{16,64}$/i.test(body.client_token || "")) {
      return e.json(400, { message: "A valid client_token is required." });
    }

    // Offline retry idempotency. The unique index is the final race guard;
    // this fast path handles the normal lost-response retry.
    const prior = $app.findRecordsByFilter(
      "calibrations", "client_token = {:token}", "", 1, 0,
      { token: body.client_token });
    if (prior.length) return e.json(200, { id: prior[0].id, duplicate: true });

    const tag = $app.findRecordById("tags", body.tag);
    const instrumentTypes = ["instrument_flow", "instrument_level", "instrument_pressure"];
    if (instrumentTypes.indexOf(tag.getString("tag_type")) < 0) {
      return e.json(400, { message: "Calibration records can only be logged for instrument tags." });
    }
    const standard = $app.findRecordById("test_standards", body.standard);

    const technician = String(body.technician || "").trim();
    const performedAt = String(body.performed_at || "").trim();
    const interval = Number(body.interval_months);
    const allowedResults = ["pass", "fail", "adjusted_pass"];
    if (!technician || !/^\d{4}-\d{2}-\d{2}/.test(performedAt)) {
      return e.json(400, { message: "Technician and calibration date are required." });
    }
    if (!Number.isInteger(interval) || interval < 1 || interval > 120) {
      return e.json(400, { message: "interval_months must be an integer from 1 to 120." });
    }
    if (allowedResults.indexOf(body.result) < 0) {
      return e.json(400, { message: "Invalid calibration result." });
    }

    let pointData;
    try { pointData = JSON.parse(body.points_json || "[]"); }
    catch (err) { return e.json(400, { message: "points_json is invalid." }); }
    if (!Array.isArray(pointData) || pointData.length < 1 || pointData.length > 25) {
      return e.json(400, { message: "Provide between 1 and 25 calibration points." });
    }
    const cleanPoints = pointData.map((p, i) => {
      const expected = Number(p.expected_value);
      const asFound = Number(p.as_found);
      const asLeft = Number(p.as_left);
      const testPoint = String(p.test_point || "").trim();
      const unit = String(p.unit || "").trim();
      if (!testPoint || !unit || !Number.isFinite(expected) ||
          !Number.isFinite(asFound) || !Number.isFinite(asLeft)) {
        throw new Error("Every point needs a label, unit, expected, as-found, and as-left value.");
      }
      return {
        sequence: i + 1, test_point: testPoint, expected_value: expected,
        as_found: asFound, as_left: asLeft,
        unit: unit, within_tolerance: p.within_tolerance === true,
      };
    });

    // PocketBase reports a missing optional multipart key as "no such file"
    // instead of an empty slice, so absence is explicitly the normal case.
    let reportFiles = [];
    try { reportFiles = e.findUploadedFiles("report") || []; }
    catch (_) { reportFiles = []; }
    if (reportFiles.length > 1) return e.json(400, { message: "Only one report may be attached." });

    const due = standard.getString("cert_due_date");
    const expired = !!due && due.slice(0, 10) < performedAt.slice(0, 10);
    let createdId = "";

    // One transaction prevents an immutable header from being stranded
    // without its point rows or an included report attachment.
    $app.runInTransaction((txApp) => {
      const cal = new Record(txApp.findCollectionByNameOrId("calibrations"));
      cal.set("tag", tag.id);
      cal.set("standard", standard.id);
      cal.set("technician", technician);
      cal.set("company", String(body.company || "").trim());
      cal.set("performed_at", performedAt);
      cal.set("interval_months", interval);
      cal.set("result", body.result);
      cal.set("notes", String(body.notes || "").trim());
      cal.set("standard_expired_at_use", expired);
      cal.set("standard_name", standard.getString("name"));
      cal.set("standard_model", standard.getString("model"));
      cal.set("standard_serial", standard.getString("serial"));
      cal.set("standard_cert_due_date", due);
      cal.set("client_token", body.client_token);
      txApp.save(cal);
      createdId = cal.id;

      const pointCollection = txApp.findCollectionByNameOrId("calibration_points");
      for (const p of cleanPoints) {
        const point = new Record(pointCollection);
        point.set("calibration", cal.id);
        point.set("sequence", p.sequence);
        point.set("test_point", p.test_point);
        point.set("expected_value", p.expected_value);
        point.set("as_found", p.as_found);
        point.set("as_left", p.as_left);
        point.set("unit", p.unit);
        point.set("within_tolerance", p.within_tolerance);
        txApp.save(point);
      }

      if (reportFiles.length) {
        const attachment = new Record(txApp.findCollectionByNameOrId("attachments"));
        attachment.set("file", reportFiles[0]);
        attachment.set("parent_collection", "calibrations");
        attachment.set("parent_id", cal.id);
        attachment.set("caption", "Calibration certificate / report");
        attachment.set("uploaded_by", technician);
        txApp.save(attachment);
      }
    });

    return e.json(201, { id: createdId, standard_expired_at_use: expired });
  } catch (err) {
    console.log("[calibrations] CAPTURE ERROR:", String(err));
    return e.json(400, { message: err && err.message ? err.message : "Could not save calibration." });
  }
});
