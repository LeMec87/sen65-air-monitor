#pragma once

#include <algorithm>
#include <cmath>
#include <cstdio>
#include <cstring>

extern const GFXfont Inter_Bold9pt7b;
extern const GFXfont Inter_Bold12pt7b;
extern const GFXfont Inter_Bold18pt7b;
extern const GFXfont Inter_Bold_Tabular18pt7b;
extern const GFXfont Inter_Bold_Tabular24pt7b;
extern const GFXfont Inter_ExtraBold_Device_Information_Subset18pt7b;
extern const GFXfont SG_Caps10;
extern const GFXfont SG_Caps13;
extern const GFXfont SG_Sub13;
extern const GFXfont SG_Head18;
extern const GFXfont SG_Value20;
extern const GFXfont SG_Value26;
extern const GFXfont SG_Status36;

namespace air_monitor
{

  namespace air_monitor_epaper_layout
  {

    struct Metrics
    {
      float co2 = NAN, temp_c = NAN, rh = NAN;
      float pm1 = NAN, pm25 = NAN, pm4 = NAN, pm10 = NAN;
      float voc = NAN, nox = NAN;
    };

    struct Point { int x, y; };

    static constexpr const GFXfont *kSmallLabelFont = &Inter_Bold9pt7b;
    static constexpr const GFXfont *kCenterMinorValueFont = &Inter_Bold_Tabular18pt7b;
    static constexpr const GFXfont *kTempSuffixFont = &Inter_Bold12pt7b;
    template <typename Display>
    inline void draw_caution_icon(Display &display, int cx, int cy, int size)
    {
      int x = cx - size / 2;
      int y = cy - size / 2;
      
      // 1. Draw a filled black diamond
      display.fillTriangle(cx, y, x + size, cy, x, cy, GxEPD_BLACK);
      display.fillTriangle(cx, y + size, x + size, cy, x, cy, GxEPD_BLACK);
      
      // 2. Draw a white diamond inside (3px border thickness ~2.1px visually)
      int b = 3; 
      display.fillTriangle(cx, y + b, x + size - b, cy, x + b, cy, GxEPD_WHITE);
      display.fillTriangle(cx, y + size - b, x + size - b, cy, x + b, cy, GxEPD_WHITE);
      
      // 3. Draw manual exclamation mark perfectly centered vertically
      int stem_w = 2;
      int stem_h = size / 3 + 1; 
      int dot_size = 2;
      int gap = 2;
      int total_h = stem_h + gap + dot_size;
      
      int stem_y = cy - total_h / 2;
      display.fillRect(cx - 1, stem_y, stem_w, stem_h, GxEPD_BLACK);
      display.fillRect(cx - 1, stem_y + stem_h + gap, dot_size, dot_size, GxEPD_BLACK);
    }

    inline bool has_real_value(float value) { return std::isfinite(value); }

    template <typename Display>
    inline void measure_text(Display &display, const GFXfont *font, const char *text,
                             int16_t &x1, int16_t &y1, uint16_t &w, uint16_t &h)
    {
      display.setFont(font);
      display.getTextBounds(text, 0, 0, &x1, &y1, &w, &h);
    }

    template <typename Display>
    inline int text_width(Display &display, const GFXfont *font, const char *text)
    {
      int16_t x1, y1; uint16_t w, h;
      measure_text(display, font, text, x1, y1, w, h);
      return static_cast<int>(w);
    }

    template <typename Display>
    inline int text_height(Display &display, const GFXfont *font, const char *text)
    {
      int16_t x1, y1; uint16_t w, h;
      measure_text(display, font, text, x1, y1, w, h);
      return static_cast<int>(h);
    }

    template <typename Display>
    inline int top_aligned_baseline(Display &display, const GFXfont *font,
                                    const char *text, int top)
    {
      int16_t x1, y1; uint16_t w, h;
      measure_text(display, font, text, x1, y1, w, h);
      return top - y1;
    }

    template <typename Display>
    inline void print_left(Display &display, int x, int y, const GFXfont *font, const char *text)
    {
      display.setFont(font);
      display.setCursor(x, y);
      display.print(text);
    }

    template <typename Display>
    inline void print_centered(Display &display, int x, int y, const GFXfont *font, const char *text)
    {
      int16_t x1, y1; uint16_t w, h;
      measure_text(display, font, text, x1, y1, w, h);
      display.setCursor(x - x1 - static_cast<int>(w) / 2, y);
      display.print(text);
    }

    template <typename Display>
    inline void print_right(Display &display, int right_x, int y, const GFXfont *font, const char *text)
    {
      int16_t x1, y1; uint16_t w, h;
      measure_text(display, font, text, x1, y1, w, h);
      display.setCursor(right_x - x1 - static_cast<int>(w), y);
      display.print(text);
    }

    template <typename Display>
    inline void draw_alert_if_needed(Display &display, const GFXfont *font,
                                     const char *text, int center_x, int baseline_y,
                                     bool alert, int icon_offset = 17, int icon_size = 24)
    {
      if (!alert) return;
      int16_t x1, y1; uint16_t w, h;
      measure_text(display, font, text, x1, y1, w, h);
      int cy = baseline_y + y1 + (int)h / 2;
      draw_caution_icon(display, center_x + (int)w / 2 + icon_offset, cy, icon_size);
    }

    inline void format_metric(char *buf, size_t size, float value, const char *format)
    {
      if (has_real_value(value)) snprintf(buf, size, format, value);
      else snprintf(buf, size, "--");
    }

    inline bool is_digits_subset_text(const char *text)
    {
      if (!text || !*text) return false;
      for (const char *p = text; *p; ++p) if ((*p < '0' || *p > '9') && *p != '.') return false;
      return true;
    }

    inline const GFXfont *metric_value_font(const char *text,
                                             const GFXfont *tabular,
                                             const GFXfont *fallback)
    {
      return is_digits_subset_text(text) ? tabular : fallback;
    }

    template <typename Display>
    inline void stamp_stroke(Display &display, int x, int y, int stroke_radius)
    {
      if (stroke_radius <= 0) { display.fillRect(x, y, 1, 1, GxEPD_BLACK); return; }
      display.fillCircle(x, y, stroke_radius, GxEPD_BLACK);
    }

    template <typename Display>
    inline void draw_stroked_line(Display &display, Point start, Point end, int stroke_radius)
    {
      const float dx = static_cast<float>(end.x - start.x);
      const float dy = static_cast<float>(end.y - start.y);
      const int steps = std::max(std::abs(end.x - start.x), std::abs(end.y - start.y));
      if (steps == 0) { stamp_stroke(display, start.x, start.y, stroke_radius); return; }
      for (int i = 0; i <= steps; ++i) {
        const float t = (float)i / (float)steps;
        stamp_stroke(display, (int)std::lround(start.x + dx * t), (int)std::lround(start.y + dy * t), stroke_radius);
      }
    }

    template <typename Display>
    inline void draw_stroked_quadratic(Display &display, Point start, Point control, Point end, int stroke_radius)
    {
      const int steps = std::max(16, std::max(std::abs(end.x - start.x), std::abs(end.y - start.y)) * 2);
      for (int i = 0; i <= steps; ++i) {
        const float t = (float)i / (float)steps;
        const float mt = 1.0f - t;
        const float x = mt * mt * start.x + 2.0f * mt * t * control.x + t * t * end.x;
        const float y = mt * mt * start.y + 2.0f * mt * t * control.y + t * t * end.y;
        stamp_stroke(display, (int)std::lround(x), (int)std::lround(y), stroke_radius);
      }
    }

    template <typename Display>
    inline void draw_divider(Display &display, int x0, int x1, int y)
    {
      display.drawLine(x0 + 1, y - 1, x1 - 1, y - 1, GxEPD_BLACK);
      display.drawLine(x0, y, x1, y, GxEPD_BLACK);
      display.drawLine(x0 + 1, y + 1, x1 - 1, y + 1, GxEPD_BLACK);
    }

    template <typename Display>
    inline void draw_corner_brace(Display &display, bool left_side, bool top_side)
    {
      Point h_start = top_side ? Point{14, 82} : Point{14, 168};
      Point h_end = top_side ? Point{101, 82} : Point{101, 168};
      Point c_ctrl = top_side ? Point{115, 82} : Point{112, 168};
      Point c_end = top_side ? Point{125, 60} : Point{125, 190};
      Point d_end = top_side ? Point{144, 18} : Point{144, 222};

      if (!left_side) {
        const int max_x = display.width() - 1;
        h_start.x = max_x - h_start.x; h_end.x = max_x - h_end.x;
        c_ctrl.x = max_x - c_ctrl.x; c_end.x = max_x - c_end.x; d_end.x = max_x - d_end.x;
      }
      draw_stroked_line(display, h_start, h_end, 1);
      draw_stroked_quadratic(display, h_end, c_ctrl, c_end, 1);
      draw_stroked_line(display, c_end, d_end, 1);
    }

    template <typename Display>
    inline void draw_ugm3_right(Display &display, int right_x, int baseline_y)
    {
      int unit_w = text_width(display, kSmallLabelFont, "ug/m");
      int total_w = unit_w + 2 + text_width(display, &Inter_Bold9pt7b, "3");
      int x = right_x - total_w;
      print_left(display, x, baseline_y, kSmallLabelFont, "ug/m");
      print_left(display, x + unit_w + 2, baseline_y - 8, &Inter_Bold9pt7b, "3");

      // Add descending tail to "u" to approximate μ
      int16_t x1, y1; uint16_t w, h;
      measure_text(display, kSmallLabelFont, "u", x1, y1, w, h);
      int tail_x = x + x1;
      int tail_top = baseline_y + y1 + (int)h - 1;
      display.fillRect(tail_x, tail_top, 2, 5, GxEPD_BLACK);
    }

    template <typename Display>
    inline void draw_pm_section(Display &display, int label_x, int unit_right_x, int label_y, int value_center_x, int value_y, const char *label, float value, bool alert)
    {
      char buf[16]; format_metric(buf, sizeof(buf), value, "%.1f");
      const GFXfont *v_font = metric_value_font(buf, &Inter_Bold_Tabular18pt7b, &Inter_Bold18pt7b);
      int adj_cx = alert ? value_center_x - 12 : value_center_x;
      print_left(display, label_x, label_y, kSmallLabelFont, label);
      draw_ugm3_right(display, unit_right_x, label_y);
      print_centered(display, adj_cx, value_y, v_font, buf);
      draw_alert_if_needed(display, v_font, buf, adj_cx, value_y, alert);
    }

    template <typename Display>
    inline void draw_index_section(Display &display, int label_x, int unit_right_x, int label_y, int value_center_x, int value_y, const char *label, float value, bool alert)
    {
      char buf[16]; format_metric(buf, sizeof(buf), value, "%.0f");
      const GFXfont *v_font = metric_value_font(buf, &Inter_Bold_Tabular18pt7b, &Inter_Bold18pt7b);
      print_left(display, label_x, label_y, kSmallLabelFont, label);
      print_right(display, unit_right_x, label_y, kSmallLabelFont, "Index");
      print_centered(display, value_center_x, value_y, v_font, buf);
      draw_alert_if_needed(display, v_font, buf, value_center_x, value_y, alert);
    }

    template <typename Display>
    inline void draw_temp_reading(Display &display, int cx, int y, float temp, char unit)
    {
      char buf[16]; format_metric(buf, sizeof(buf), temp, "%.1f");
      char unit_str[2] = { unit, '\0' };
      if (!has_real_value(temp)) unit_str[0] = '\0';

      int16_t x1, y1; uint16_t w_val, w_unit, h_val, v_h;
      display.setFont(kCenterMinorValueFont); display.getTextBounds(buf, 0, 0, &x1, &y1, &w_val, &v_h);
      display.setFont(kTempSuffixFont); display.getTextBounds(unit_str[0] ? unit_str : "", 0, 0, &x1, &y1, &w_unit, &h_val);

      int gap = unit_str[0] ? 14 : 0, total_w = w_val + gap + w_unit, start_x = cx - total_w / 2;
      print_left(display, start_x, y, kCenterMinorValueFont, buf);
      if (unit_str[0]) {
        display.drawCircle(start_x + w_val + gap - 3, y - (int)v_h + 11, 3, GxEPD_BLACK);
        display.drawCircle(start_x + w_val + gap - 3, y - (int)v_h + 11, 2, GxEPD_BLACK);
        print_left(display, start_x + w_val + gap + 1, y - 1, kTempSuffixFont, unit_str);
      }
    }

    template <typename Display>
    inline void draw_humidity_reading(Display &display, int cx, int y, float rh)
    {
      char buf[16]; format_metric(buf, sizeof(buf), rh, "%.1f");
      const char *suffix = has_real_value(rh) ? "%" : "";
      int16_t x1, y1; uint16_t w_val, w_suffix, h;
      display.setFont(kCenterMinorValueFont); display.getTextBounds(buf, 0, 0, &x1, &y1, &w_val, &h);
      display.setFont(kTempSuffixFont); display.getTextBounds(suffix, 0, 0, &x1, &y1, &w_suffix, &h);

      int gap = *suffix ? 4 : 0, start_x = cx - (w_val + gap + w_suffix) / 2;
      print_left(display, start_x, y, kCenterMinorValueFont, buf);
      if (*suffix) print_left(display, start_x + w_val + gap, y - 1, kTempSuffixFont, suffix);
    }

    template <typename Display>
    inline const GFXfont *fitting_font(Display &display, const char *text, int max_width,
                                       const GFXfont *preferred, const GFXfont *fallback)
    {
      return text_width(display, preferred, text) <= max_width ? preferred : fallback;
    }

    template <typename Display>
    inline void draw_info_triangle(Display &display, int x, int y, int width, int height)
    {
      display.fillTriangle(x, y, x, y + height, x + width, y + height / 2, GxEPD_BLACK);
    }

    template <typename Display>
    inline void draw_centered_info_underline(Display &display, int center_x, int y, int width)
    {
      const int start_x = center_x - width / 2;
      draw_divider(display, start_x, start_x + width, y);
    }

    template <typename Display>
    inline void draw_instruction_tab_outline(Display &display, int x, int y,
                                             bool mirror_x, bool mirror_y)
    {
      static constexpr Point kOutline[] = {
          {0, 0}, {19, 0}, {24, 5}, {24, 18}, {14, 24}, {0, 24}};

      auto map_point = [&](Point point) -> Point
      {
        const int px = mirror_x ? x + (24 - point.x) : x + point.x;
        const int py = mirror_y ? y + (24 - point.y) : y + point.y;
        return {px, py};
      };

      for (size_t i = 0; i < (sizeof(kOutline) / sizeof(kOutline[0])); ++i)
      {
        const Point start = map_point(kOutline[i]);
        const Point end = map_point(kOutline[(i + 1) % (sizeof(kOutline) / sizeof(kOutline[0]))]);
        display.drawLine(start.x, start.y, end.x, end.y, GxEPD_BLACK);
      }

      const int inner_x = mirror_x ? x + 11 : x + 4;
      const int inner_y = mirror_y ? y + 10 : y + 5;
      display.drawRect(inner_x, inner_y, 9, 9, GxEPD_BLACK);
    }

    template <typename Display>
    inline void draw_disconnected_info_bracket(Display &display, int qr_x, int qr_y,
                                               int qr_box_size, bool top_half)
    {
      const int qr_right = qr_x + qr_box_size;
      const int horizontal_y = top_half ? qr_y - 26 : qr_y + qr_box_size + 20;

      Point h_start = {28, horizontal_y};
      Point h_end = {qr_right - 18, horizontal_y};
      Point c_ctrl = {qr_right - 2, horizontal_y};
      Point c_end = {qr_right + 6, top_half ? horizontal_y + 12 : horizontal_y - 12};
      Point d_end = {qr_right + 20, top_half ? qr_y + 10 : qr_y + qr_box_size - 10};

      draw_stroked_line(display, h_start, h_end, 1);
      draw_stroked_quadratic(display, h_end, c_ctrl, c_end, 1);
      draw_stroked_line(display, c_end, d_end, 1);
    }

    template <typename Display, typename DrawQr>
    inline void render_disconnected_info_layout(Display &display, const char *setup_ap_name,
                                                const char *instructions_target,
                                                DrawQr draw_qr)
    {
      const char *title = "Device Information";
      const char *instructions_text = "Instructions";
      const char *wifi_text = "WiFi Not Connected";
      const char *reboot_text = "Reboot To Enable";
      const char *setup_text = "Setup AP";
      const char *hold_text = "Hold button (3s)";
      const char *hold_text_line_2 = "to reboot";
      char ssid_text[64];
      snprintf(ssid_text, sizeof(ssid_text), "(%s)",
               (setup_ap_name != nullptr && setup_ap_name[0] != '\0') ? setup_ap_name : "aether");

      display.fillScreen(GxEPD_WHITE);
      display.setTextColor(GxEPD_BLACK);

      static constexpr int qr_scale = 4;
      static constexpr int qr_padding = 4;
      static constexpr int qr_module_count = 29;
      static constexpr int qr_box_size = qr_padding * 2 + qr_module_count * qr_scale;
      static constexpr int qr_x = 18;
      static constexpr int qr_y = 92;
      static constexpr int instructions_y = 88;
      static constexpr int right_title_top = 65;
      static constexpr int right_action_gap = 22;
      static constexpr int wifi_underline_gap = 15;
      static constexpr int after_underline_gap = 16;
      static constexpr int setup_underline_gap = 14;
      static constexpr int hold_group_gap = 18;
      static constexpr int hold_line_gap = 18;

      print_centered(display, display.width() / 2, 36,
                     &Inter_ExtraBold_Device_Information_Subset18pt7b, title);
      draw_centered_info_underline(display, display.width() / 2, 47, 108);
      draw_info_triangle(display, display.width() - 18, 13, 14, 26);

      print_centered(display, qr_x + qr_box_size / 2, instructions_y,
                     &Inter_Bold9pt7b, instructions_text);
      draw_disconnected_info_bracket(display, qr_x, qr_y, qr_box_size, true);
      draw_disconnected_info_bracket(display, qr_x, qr_y, qr_box_size, false);
      draw_qr(qr_x, qr_y, instructions_target, qr_scale, qr_padding);

      const int right_block_left = qr_x + qr_box_size + 34;
      const int right_block_right = display.width() - 18;
      const int right_block_width = right_block_right - right_block_left;
      const int right_center_x = right_block_left + right_block_width / 2;
      const GFXfont *wifi_font =
          fitting_font(display, wifi_text, right_block_width - 12,
                       &Inter_Bold18pt7b, &Inter_Bold12pt7b);
      const GFXfont *action_font =
          fitting_font(display, setup_text, right_block_width - 16,
                       &Inter_Bold12pt7b, &Inter_Bold9pt7b);
      const GFXfont *ssid_font = &Inter_Bold9pt7b;
      const GFXfont *hold_font = &Inter_Bold9pt7b;

      const int wifi_y = top_aligned_baseline(display, wifi_font, wifi_text, right_title_top);
      const int wifi_underline_y =
          right_title_top + text_height(display, wifi_font, wifi_text) + wifi_underline_gap;
      const int right_action_top = wifi_underline_y + after_underline_gap;
      const int reboot_y =
          top_aligned_baseline(display, action_font, reboot_text, right_action_top);
      const int setup_y =
          top_aligned_baseline(display, action_font, setup_text, right_action_top + right_action_gap);
      const int ssid_top = right_action_top + right_action_gap * 2;
      const int ssid_y = top_aligned_baseline(display, ssid_font, ssid_text, ssid_top);
      const int setup_underline_y =
          ssid_top + text_height(display, ssid_font, ssid_text) + setup_underline_gap;
      const int hold_top = setup_underline_y + hold_group_gap - 4;
      const int hold_y = top_aligned_baseline(display, hold_font, hold_text, hold_top);

      print_centered(display, right_center_x, wifi_y, wifi_font, wifi_text);
      draw_centered_info_underline(
          display, right_center_x, wifi_underline_y,
          std::min(right_block_width - 24, text_width(display, wifi_font, wifi_text) + 10));

      print_centered(display, right_center_x, reboot_y, action_font, reboot_text);
      print_centered(display, right_center_x, setup_y, action_font, setup_text);
      print_centered(display, right_center_x, ssid_y, ssid_font, ssid_text);
      draw_centered_info_underline(
          display, right_center_x, setup_underline_y,
          std::min(170, std::max(text_width(display, action_font, setup_text),
                                 text_width(display, ssid_font, ssid_text)) + 14));

      print_centered(display, right_center_x, hold_y, hold_font, hold_text);
      print_centered(display, right_center_x,
                     top_aligned_baseline(display, hold_font, hold_text_line_2,
                                          hold_top + hold_line_gap),
                     hold_font, hold_text_line_2);
    }

    template <typename Display>
    inline void render_sketch_layout(Display &display, const Metrics &metrics, bool use_f,
                                     const char *date_text, const char *time_text)
    {
      const float display_temp = use_f ? (metrics.temp_c * 1.8f + 32.0f) : metrics.temp_c;

      display.fillScreen(GxEPD_WHITE);
      display.setTextColor(GxEPD_BLACK);

      draw_corner_brace(display, true, true); draw_corner_brace(display, false, true);
      draw_corner_brace(display, true, false); draw_corner_brace(display, false, false);
      draw_divider(display, 164, 251, 79); draw_divider(display, 164, 251, 172);

      draw_pm_section(display, 12, 125, 23, 64, 64, "PM1", metrics.pm1, metrics.pm1 > 15.0f);
      draw_pm_section(display, 286, 404, 23, 351, 64, "PM2.5", metrics.pm25, metrics.pm25 > 15.0f);
      draw_temp_reading(display, 208, 53, display_temp, use_f ? 'F' : 'C');

      draw_index_section(display, 12, 121, 105, 63, 149, "VOC", metrics.voc, metrics.voc > 250.0f);
      // SEN65 has no CO2 channel: the center cell shows date + time instead
      print_centered(display, 208, 105, kSmallLabelFont, date_text);
      print_centered(display, 208, 153, &Inter_Bold_Tabular24pt7b, time_text);
      draw_index_section(display, 295, 404, 105, 349, 149, "NOx", metrics.nox, metrics.nox > 100.0f);

      draw_pm_section(display, 12, 125, 233, 64, 207, "PM4", metrics.pm4, metrics.pm4 > 30.0f);
      draw_humidity_reading(display, 208, 216, metrics.rh);
      draw_pm_section(display, 286, 404, 233, 351, 207, "PM10", metrics.pm10, metrics.pm10 > 50.0f);
    }


    // ======================================================================
    // Status layout (Space Grotesk): air-quality status word, PM2.5/VOC,
    // 3-segment scale, PM1/PM4/PM10/NOx row. Strings are Latin-1 encoded (for ° and ·).
    //
    // Grid (416x240): 16 px side margins. Baselines:
    //   header 28 (date | temp, rh | time) | hero 78 / 112 |
    //   scale bar 128-134, labels 152 | rule 168 | labels 192 | values 224
    // ======================================================================

    namespace status_layout
    {
      static constexpr int L = 16, R = 400;
      static constexpr int HERO_LABEL_R = 334;   // right edge of the PM2.5 / VOC labels
      static constexpr float CAPS_TRACK = 1.5f;

      // Sum of glyph advances (matches the preview's anchor math)
      inline float advance_width(const GFXfont *font, const char *text, float track = 0.0f)
      {
        float w = 0.0f;
        int n = 0;
        for (const uint8_t *p = reinterpret_cast<const uint8_t *>(text); *p; ++p)
        {
          if (*p < font->first || *p > font->last) continue;
          w += font->glyph[*p - font->first].xAdvance;
          ++n;
        }
        if (n > 1) w += track * (n - 1);
        return w;
      }

      // align: 'l' left, 'm' centered, 'r' right
      template <typename Display>
      inline void print_text(Display &display, float x, int y, const GFXfont *font,
                             const char *text, char align = 'l', float track = 0.0f)
      {
        const float w = advance_width(font, text, track);
        if (align == 'm') x -= w / 2.0f;
        else if (align == 'r') x -= w;
        display.setFont(font);
        for (const uint8_t *p = reinterpret_cast<const uint8_t *>(text); *p; ++p)
        {
          if (*p < font->first || *p > font->last) continue;
          display.setCursor(static_cast<int>(std::lround(x)), y);
          display.write(*p);
          x += font->glyph[*p - font->first].xAdvance + track;
        }
      }

      template <typename Display>
      inline void print_caps(Display &display, float x, int y, const char *text, char align = 'l',
                             const GFXfont *font = &SG_Caps13)
      {
        print_text(display, x, y, font, text, align, CAPS_TRACK);
      }

      // one decimal below 100, whole numbers above (keeps columns from colliding)
      inline void fmt1(char *buf, size_t size, float v)
      {
        if (!has_real_value(v)) snprintf(buf, size, "--");
        else snprintf(buf, size, v >= 100.0f ? "%.0f" : "%.1f", v);
      }

      inline void fmt0(char *buf, size_t size, float v)
      {
        if (!has_real_value(v)) snprintf(buf, size, "--");
        else snprintf(buf, size, "%.0f", v);
      }

      // Map a value onto a 0..3 scale with segment borders a, b and scale end top
      inline float level_pos(float v, float a, float b, float top)
      {
        if (!has_real_value(v)) return 0.0f;
        if (v <= a) return v / a;
        if (v <= b) return 1.0f + (v - a) / (b - a);
        return std::min(3.0f, 2.0f + (v - b) / (top - b));
      }

      inline int level_of(float pos) { return std::min(2, static_cast<int>(pos)); }

      // --- weather icons, drawn into an 18 x 18 box with top-left (x, y) ---
      enum Weather { WEATHER_UNKNOWN = -1, WEATHER_SUN = 0, WEATHER_CLOUD = 1,
                     WEATHER_RAIN = 2, WEATHER_MOON = 3, WEATHER_PARTLY_CLOUDY = 4,
                     WEATHER_HEAVY_RAIN = 5, WEATHER_THUNDERSTORM = 6,
                     WEATHER_SNOW = 7 };
      static constexpr int ICON_W = 18;

      template <typename Display>
      inline void draw_cloud(Display &display, int x, int y)
      {
        // black silhouette, then the same shape inset by 2 px in white -> 2 px outline
        for (int g = 0; g <= 2; g += 2)
        {
          const uint16_t c = g == 0 ? GxEPD_BLACK : GxEPD_WHITE;
          display.fillCircle(x + 5, y + 7, 4 - g, c);
          display.fillCircle(x + 10, y + 5, 5 - g, c);
          display.fillCircle(x + 14, y + 8, 3 - g, c);
          display.fillRect(x + 1 + g, y + 7, 16 - 2 * g, 5 - g, c);
        }
      }

      // 2 px wide line (matches the stroke weight of the header digits)
      template <typename Display>
      inline void draw_thick_line(Display &display, int x0, int y0, int x1, int y1)
      {
        const bool steep = std::abs(y1 - y0) > std::abs(x1 - x0);
        display.drawLine(x0, y0, x1, y1, GxEPD_BLACK);
        if (steep) display.drawLine(x0 + 1, y0, x1 + 1, y1, GxEPD_BLACK);
        else display.drawLine(x0, y0 + 1, x1, y1 + 1, GxEPD_BLACK);
      }

      template <typename Display>
      inline void draw_weather_icon(Display &display, int x, int y, int weather)
      {
        if (weather == WEATHER_SUN)
        {
          const int cx = x + 9, cy = y + 8;
          display.fillCircle(cx, cy, 3, GxEPD_BLACK);
          for (int i = 0; i < 8; ++i)
          {
            const float a = i * 3.14159265f / 4.0f;
            const float r0 = 6.0f, r1 = (i % 2) ? 7.0f : 8.0f;
            draw_thick_line(display, static_cast<int>(std::lround(cx + r0 * std::cos(a))),
                            static_cast<int>(std::lround(cy + r0 * std::sin(a))),
                            static_cast<int>(std::lround(cx + r1 * std::cos(a))),
                            static_cast<int>(std::lround(cy + r1 * std::sin(a))));
          }
        }
        else if (weather == WEATHER_MOON)
        {
          // crescent: full disc minus an offset disc
          const int cx = x + 9, cy = y + 8;
          display.fillCircle(cx, cy, 7, GxEPD_BLACK);
          display.fillCircle(cx + 4, cy - 3, 6, GxEPD_WHITE);
        }
        else if (weather == WEATHER_CLOUD)
        {
          draw_cloud(display, x, y + 2);
        }
        else if (weather == WEATHER_PARTLY_CLOUDY)
        {
          // Sun peeking above the cloud, with a clean white separation.
          display.fillCircle(x + 6, y + 5, 3, GxEPD_BLACK);
          display.drawLine(x + 6, y, x + 6, y + 1, GxEPD_BLACK);
          display.drawLine(x + 1, y + 1, x + 2, y + 2, GxEPD_BLACK);
          display.drawLine(x, y + 5, x + 1, y + 5, GxEPD_BLACK);
          display.drawLine(x + 10, y + 1, x + 11, y, GxEPD_BLACK);
          display.fillRect(x + 1, y + 8, 16, 8, GxEPD_WHITE);
          draw_cloud(display, x, y + 4);
        }
        else if (weather == WEATHER_RAIN || weather == WEATHER_HEAVY_RAIN)
        {
          draw_cloud(display, x, y);
          const int drops = weather == WEATHER_HEAVY_RAIN ? 4 : 2;
          for (int i = 0; i < drops; ++i) {
            const int dx = x + (drops == 2 ? 6 + 7 * i : 3 + 4 * i);
            if (drops == 2) display.drawLine(dx, y + 13, dx - 1, y + 15, GxEPD_BLACK);
            else draw_thick_line(display, dx, y + 12, dx - 2, y + 16);
          }
        }
        else if (weather == WEATHER_SNOW)
        {
          // Six-arm snowflake; all branches stay inside the 18 x 18 header box.
          const int cx = x + 9, cy = y + 9;
          for (int i = 0; i < 6; ++i)
          {
            const float a = i * 3.14159265f / 3.0f - 3.14159265f / 2.0f;
            const float dx = std::cos(a), dy = std::sin(a);
            draw_thick_line(display, cx, cy,
                            cx + static_cast<int>(std::lround(7 * dx)),
                            cy + static_cast<int>(std::lround(7 * dy)));
            const int bx = cx + static_cast<int>(std::lround(4 * dx));
            const int by = cy + static_cast<int>(std::lround(4 * dy));
            for (int side : {-1, 1})
              display.drawLine(bx, by,
                               cx + static_cast<int>(std::lround(2 * dx - side * 2 * dy)),
                               cy + static_cast<int>(std::lround(2 * dy + side * 2 * dx)),
                               GxEPD_BLACK);
          }
        }
        else if (weather == WEATHER_THUNDERSTORM)
        {
          draw_cloud(display, x, y);
          // Solid zigzag bolt, kept within the existing header icon box.
          display.fillTriangle(x + 10, y + 9, x + 6, y + 14, x + 11, y + 14, GxEPD_BLACK);
          display.fillTriangle(x + 8, y + 12, x + 13, y + 12, x + 7, y + 17, GxEPD_BLACK);
        }
      }
    } // namespace status_layout

    template <typename Display>
    inline void draw_update_available_icon(Display &display, int x, int y)
    {
      // A crisp 16-pixel download badge; no new font or periodic blinking.
      display.fillRoundRect(x, y, 16, 16, 3, GxEPD_BLACK);
      display.fillRect(x + 7, y + 3, 2, 7, GxEPD_WHITE);
      display.drawLine(x + 4, y + 6, x + 7, y + 9, GxEPD_WHITE);
      display.drawLine(x + 8, y + 9, x + 11, y + 6, GxEPD_WHITE);
      display.drawLine(x + 4, y + 11, x + 4, y + 12, GxEPD_WHITE);
      display.drawLine(x + 4, y + 12, x + 11, y + 12, GxEPD_WHITE);
      display.drawLine(x + 11, y + 11, x + 11, y + 12, GxEPD_WHITE);
    }

    template <typename Display>
    inline void render_status_layout(Display &display, const Metrics &metrics, bool use_f,
                                     const char *date_text, const char *time_text, int weather,
                                     bool update_available = false)
    {
      using namespace status_layout;
      static const char *const kWords[] = {"Good", "Moderate", "Poor"};
      static const char *const kLevels[] = {"good", "moderate", "high"};
      static const char *const kScale[] = {"GOOD", "MODERATE", "POOR"};
      char buf[48], buf2[24];

      display.fillScreen(GxEPD_WHITE);
      display.setTextColor(GxEPD_BLACK);

      // --- header: date + time left, temp | rh | weather icon right ---
      print_text(display, L, 28, &SG_Head18, date_text);
      const float date_width = advance_width(&SG_Head18, date_text);
      print_text(display, L + date_width + 12.0f, 28, &SG_Head18, time_text);

      const float temp = use_f ? (metrics.temp_c * 1.8f + 32.0f) : metrics.temp_c;
      fmt1(buf, sizeof(buf), temp);
      if (has_real_value(temp)) strncat(buf, "\xB0", sizeof(buf) - strlen(buf) - 1);
      fmt0(buf2, sizeof(buf2), metrics.rh);
      if (has_real_value(metrics.rh)) strncat(buf2, "%", sizeof(buf2) - strlen(buf2) - 1);
      {
        const float gap = 12.0f, sep = 2 * gap + 1;  // text, gap, 1 px line, gap
        const bool icon = weather >= WEATHER_SUN;
        const float wt = advance_width(&SG_Head18, buf), wr = advance_width(&SG_Head18, buf2);
        const float total = wt + sep + wr + (icon ? sep + ICON_W : 0.0f);
        // Right-aligned climate group. This keeps its right edge stable when
        // temperature or humidity changes and leaves the clock beside the date.
        const float x_temp = R - total;
        if (update_available) {
          const float clock_end = L + date_width + 12.0f + advance_width(&SG_Head18, time_text);
          // Preserve readable addresses/readings even on long dates or values.
          if (x_temp - clock_end >= 28.0f)
            draw_update_available_icon(display, static_cast<int>(std::lround((clock_end + x_temp) / 2)) - 8, 13);
          else
            draw_update_available_icon(display, 230, 53);
        }
        const float x_rh = x_temp + wt + sep;
        print_text(display, x_temp, 28, &SG_Head18, buf);
        display.drawLine(static_cast<int>(std::lround(x_temp + wt + gap)), 15,
                         static_cast<int>(std::lround(x_temp + wt + gap)), 28, GxEPD_BLACK);
        print_text(display, x_rh, 28, &SG_Head18, buf2);
        if (icon)
        {
          const int sep_x = static_cast<int>(std::lround(x_rh + wr + gap));
          display.drawLine(sep_x, 15, sep_x, 28, GxEPD_BLACK);
          draw_weather_icon(display, static_cast<int>(std::lround(x_rh + wr + sep)), 12, weather);
        }
      }

      // --- status: worst of PM2.5 and VOC ---
      const float p_pm = level_pos(metrics.pm25, 12.0f, 35.0f, 60.0f);
      const float p_voc = level_pos(metrics.voc, 150.0f, 250.0f, 400.0f);
      const float pos = std::max(p_pm, p_voc);
      const bool have_status = has_real_value(metrics.pm25) || has_real_value(metrics.voc);

      if (have_status)
      {
        print_text(display, L - 1, 78, &SG_Status36, kWords[level_of(pos)]);
        snprintf(buf, sizeof(buf), "Particles %s  \xB7  VOC %s", kLevels[level_of(p_pm)], kLevels[level_of(p_voc)]);
        print_text(display, L, 112, &SG_Sub13, buf);
      }

      // --- hero right: the two values driving the status ---
      fmt1(buf, sizeof(buf), metrics.pm25);
      print_text(display, R, 78, &SG_Value26, buf, 'r');
      print_caps(display, HERO_LABEL_R, 78, "PM2.5", 'r');

      fmt0(buf, sizeof(buf), metrics.voc);
      print_text(display, R, 112, &SG_Value26, buf, 'r');
      print_caps(display, HERO_LABEL_R, 112, "VOC", 'r');

      // --- scale: three equal segments (solid / dithered / outline) + marker ---
      {
        const int y = 128, h = 7;
        const float gap = 4.0f, seg = (R - L - 2 * gap) / 3.0f;
        for (int i = 0; i < 3; ++i)
        {
          const float fx0 = L + i * (seg + gap);
          const int x0 = static_cast<int>(std::lround(fx0));
          const int x1 = static_cast<int>(std::lround(fx0 + seg));
          if (i == 0)
            display.fillRect(x0, y, x1 - x0 + 1, h, GxEPD_BLACK);
          else if (i == 1)
          {
            for (int yy = y; yy < y + h; ++yy)
              for (int xx = x0; xx <= x1; ++xx)
                if (((xx + yy) & 1) == 0) display.drawPixel(xx, yy, GxEPD_BLACK);
          }
          else
            display.drawRect(x0, y, x1 - x0 + 1, h, GxEPD_BLACK);
          print_caps(display, fx0, 152, kScale[i], 'l', &SG_Caps10);
        }
        if (have_status)
        {
          const int si = level_of(pos);
          const float frac = pos < 3.0f ? pos - si : 1.0f;
          float mx = L + si * (seg + gap) + frac * seg;
          mx = std::max<float>(L + 5, std::min<float>(R - 5, mx));
          const int m = static_cast<int>(std::lround(mx));
          display.fillTriangle(m - 5, y - 8, m + 5, y - 8, m, y - 2, GxEPD_BLACK);
        }
      }

      // --- bottom row: PM1, PM4, PM10, NOx centered, gapped separators ---
      display.drawLine(L, 168, R, 168, GxEPD_BLACK);
      {
        const char *labels[] = {"PM1", "PM4", "PM10", "NOX"};
        const float values[] = {metrics.pm1, metrics.pm4, metrics.pm10, metrics.nox};
        const float cw = (R - L) / 4.0f;
        for (int i = 0; i < 4; ++i)
        {
          const float cx = L + (i + 0.5f) * cw;
          if (i < 3) fmt1(buf, sizeof(buf), values[i]);
          else fmt0(buf, sizeof(buf), values[i]);
          print_caps(display, cx, 192, labels[i], 'm');
          print_text(display, cx, 224, &SG_Value20, buf, 'm');
          if (i)
          {
            const int x = static_cast<int>(std::lround(L + i * cw));
            display.drawLine(x, 180, x, 228, GxEPD_BLACK);
          }
        }
      }
    }

  } // namespace air_monitor_epaper_layout
} // namespace air_monitor
