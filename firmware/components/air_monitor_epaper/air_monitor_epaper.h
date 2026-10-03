#pragma once

#include <Arduino.h>
#include <GxEPD2_BW.h>
#include <SPI.h>
#include <Wire.h>
#include <cmath>
#include <cstring>
#include <string>
#include <qrcode.h>

// ESPHome includes
#include "esphome/core/application.h"
#include "esphome/components/wifi/wifi_component.h"
#include "esphome/components/web_server_base/web_server_base.h"

// Layout and Fonts
#include "Inter_Bold12pt7b.h"
#include "Inter_Bold18pt7b.h"
#include "Inter_Bold9pt7b.h"
#include "Inter_Bold_Tabular18pt7b.h"
#include "Inter_Bold_Tabular24pt7b.h"
#include "Inter_ExtraBold_Device_Information_Subset18pt7b.h"
#include "Inter_ExtraBold_Factory_Reset_Subset20pt7b.h"
#include "Satoshi_800_Logo_Subset22pt7b.h"
#include "SG_Caps10.h"
#include "SG_Caps13.h"
#include "SG_Sub13.h"
#include "SG_Head18.h"
#include "SG_Value20.h"
#include "SG_Value26.h"
#include "SG_Boot28.h"
#include "SG_Status36.h"
#include "SG_Info12.h"
#include "air_monitor_epaper_layout.h"

namespace air_monitor
{

  namespace air_monitor_epaper
  {

// ==== SPI + Display Pin Configuration ====
#define EPD_MOSI 7
#define EPD_SCK 6
#define EPD_CS 5
#define EPD_DC 4
#define EPD_RST 3
#define EPD_BUSY 1

    // GDEY037T03 (416x240)
    static GxEPD2_BW<GxEPD2_370_GDEY037T03, GxEPD2_370_GDEY037T03::HEIGHT>
        display(GxEPD2_370_GDEY037T03(EPD_CS, EPD_DC, EPD_RST, EPD_BUSY));

    // --- State ---
    enum DisplayMode
    {
      MODE_BOOT,
      MODE_NORMAL,
      MODE_PARTICLES,
      MODE_GASES,
      MODE_CLIMATE,
      MODE_INFO,
      MODE_RESET
    };

    static bool s_inited = false;
    static DisplayMode g_display_mode = MODE_BOOT;
    static bool g_use_f = false;
    static bool g_update_available = false;
    static uint8_t g_boot_full_refreshes = 0;
    static uint8_t g_boot_frame = 0;
    static int8_t g_last_info_wifi_state = -1;
    static unsigned long g_last_normal_render_ms = 0;
    static unsigned long g_last_boot_frame_ms = 0;
    static unsigned long g_boot_start_ms = 0;

    // --- Cached Layout Data ---
    struct BootWordmarkLayout
    {
      int baseline_y, left_x, slash_1_x, slash_2_x, right_x;
    };
    static BootWordmarkLayout g_boot_layout = {0, 0, 0, 0, 0};

    // --- Cached readings (stored in °C internally) ---
    static float g_co2 = NAN, g_temp = NAN, g_rh = NAN;
    static float g_pm1 = NAN, g_pm25 = NAN, g_pm4 = NAN, g_pm10 = NAN;
    static float g_voc = NAN, g_nox = NAN;
    static std::string g_date_text = "--.--.----", g_time_text = "--:--";
    static int g_weather = -1;  // -1 unknown, 0 sun, 1 cloud, 2 rain, 3 moon

    // --- 24-hour history (5-minute samples, held in RAM) ---
    enum HistoryMetric
    {
      HISTORY_PM1,
      HISTORY_PM25,
      HISTORY_PM4,
      HISTORY_PM10,
      HISTORY_VOC,
      HISTORY_NOX,
      HISTORY_TEMP,
      HISTORY_RH,
      HISTORY_METRIC_COUNT
    };
    static constexpr size_t HISTORY_POINTS = 288;
    static float g_history[HISTORY_METRIC_COUNT][HISTORY_POINTS] = {};
    static uint16_t g_history_head = 0;
    static uint16_t g_history_count = 0;
    static unsigned long g_last_history_sample_ms = 0;
    static float g_history_accumulator[HISTORY_METRIC_COUNT] = {};
    static uint16_t g_history_accumulator_count = 0;

    // --- Config ---
    static constexpr unsigned long NORMAL_REFRESH_MS = 5000;
    static constexpr unsigned long HISTORY_SAMPLE_MS = 5UL * 60UL * 1000UL;
    static constexpr unsigned long BOOT_FRAME_MS = 900;
    static constexpr uint8_t BOOT_SLASH_FRAME_COUNT = 4;
    static constexpr unsigned long BOOT_TIMEOUT_MS = 75000;
    static constexpr const char *INFO_INSTRUCTIONS_URL = "https://github.com/LeMec87/sen65-air-monitor";

    inline void draw_info_qr_card(int x, int y, const char *target);
    inline void draw_info_qr_card(int x, int y, const char *target,
                                  int scale, int padding);
    inline void draw_connected_info_bracket(bool left_side);

    // --- Paged Rendering Helper ---
    template <typename F>
    inline void render_paged(bool full_refresh, F &&draw_func)
    {
      if (full_refresh)
        display.setFullWindow();
      else
        display.setPartialWindow(0, 0, display.width(), display.height());

      display.firstPage();
      do
      {
        draw_func();
        esphome::App.feed_wdt();
      } while (display.nextPage());
    }

    // --- Screenshot: GET /screen.pbm renders the main screen into an
    // off-screen canvas and returns it as a 1-bit PBM image ---
    class ScreenshotHandler : public AsyncWebHandler
    {
    public:
      bool canHandle(AsyncWebServerRequest *request) const override
      {
        return request->url() == "/screen.pbm";
      }

      void handleRequest(AsyncWebServerRequest *request) override
      {
        GFXcanvas1 canvas(display.width(), display.height());
        uint8_t *buf = canvas.getBuffer();
        if (buf == nullptr)
        {
          request->send(500, "text/plain", "out of memory");
          return;
        }
        air_monitor_epaper_layout::Metrics m = {g_co2, g_temp, g_rh, g_pm1, g_pm25, g_pm4, g_pm10, g_voc, g_nox};
        air_monitor_epaper_layout::render_status_layout(canvas, m, g_use_f, g_date_text.c_str(), g_time_text.c_str(),
                                                   g_weather);

        const size_t row_bytes = (canvas.width() + 7) / 8;
        std::string body = "P4\n" + std::to_string(canvas.width()) + " " + std::to_string(canvas.height()) + "\n";
        body.reserve(body.size() + row_bytes * canvas.height());
        for (size_t i = 0; i < row_bytes * canvas.height(); ++i)
          body.push_back(static_cast<char>(~buf[i]));  // PBM: 1 = black
        request->send(request->beginResponse(200, "image/x-portable-bitmap", body));
      }

      bool isRequestHandlerTrivial() const override { return false; }
    };

    // --- Initialization & Validation ---
    inline void init_once()
    {
      if (s_inited)
        return;

      pinMode(EPD_CS, OUTPUT);
      pinMode(EPD_DC, OUTPUT);
      pinMode(EPD_RST, OUTPUT);
      pinMode(EPD_BUSY, INPUT);

      SPI.begin(EPD_SCK, -1, EPD_MOSI);
      display.init(115200, true, 2, false);
      display.setRotation(1);

      // Calculate the independent project wordmark once.
      display.setFont(&SG_Boot28);
      int16_t x1, y1;
      uint16_t w, h;
      display.getTextBounds("AIR MONITOR", 0, 0, &x1, &y1, &w, &h);
      int baseline_y = display.height() / 2 - y1 - static_cast<int>(h) / 2;

      int left_x = display.width() / 2 - static_cast<int>(w) / 2 - x1;
      g_boot_layout = {baseline_y, left_x, 0, 0, 0};

      if (esphome::web_server_base::global_web_server_base != nullptr)
        esphome::web_server_base::global_web_server_base->add_handler(new ScreenshotHandler());

      s_inited = true;
    }

    inline bool all_metrics_ready()
    {
      // CO2 intentionally not required (SEN65 has no CO2 channel)
      return air_monitor_epaper_layout::has_real_value(g_temp) &&
             air_monitor_epaper_layout::has_real_value(g_rh) &&
             air_monitor_epaper_layout::has_real_value(g_pm1) &&
             air_monitor_epaper_layout::has_real_value(g_pm25) &&
             air_monitor_epaper_layout::has_real_value(g_pm4) &&
             air_monitor_epaper_layout::has_real_value(g_pm10) &&
             air_monitor_epaper_layout::has_real_value(g_voc) &&
             air_monitor_epaper_layout::has_real_value(g_nox);
    }

    inline void draw_boot_content(uint8_t frame)
    {
      display.setTextColor(GxEPD_BLACK);
      air_monitor_epaper_layout::print_left(display, g_boot_layout.left_x, g_boot_layout.baseline_y,
                                            &SG_Boot28, "AIR MONITOR");
      air_monitor_epaper_layout::print_centered(display, display.width() / 2,
                                                 g_boot_layout.baseline_y + 34,
                                                 &SG_Caps10, "SENSORS STARTING");
      const int start_x = display.width() / 2 - 35;
      const int y = g_boot_layout.baseline_y + 46;
      for (uint8_t i = 0; i < BOOT_SLASH_FRAME_COUNT; ++i)
      {
        const int x = start_x + i * 20;
        if (i == frame)
          display.fillRect(x, y - 2, 11, 4, GxEPD_BLACK);
        else
          display.drawLine(x, y, x + 10, y, GxEPD_BLACK);
      }
    }

    inline float history_value(HistoryMetric metric, uint16_t logical_index)
    {
      const size_t oldest = (g_history_head + HISTORY_POINTS - g_history_count) % HISTORY_POINTS;
      float value = g_history[metric][(oldest + logical_index) % HISTORY_POINTS];
      if (metric == HISTORY_TEMP && g_use_f)
        value = value * 9.0f / 5.0f + 32.0f;
      return value;
    }

    inline void sample_history(unsigned long now)
    {
      if (!all_metrics_ready())
        return;

      const float values[HISTORY_METRIC_COUNT] = {
          g_pm1, g_pm25, g_pm4, g_pm10, g_voc, g_nox, g_temp, g_rh};

      // Make the first valid reading visible immediately.
      if (g_history_count == 0)
      {
        for (size_t metric = 0; metric < HISTORY_METRIC_COUNT; ++metric)
          g_history[metric][g_history_head] = values[metric];
        g_history_head = (g_history_head + 1) % HISTORY_POINTS;
        g_history_count = 1;
        g_last_history_sample_ms = now;
        return;
      }

      // Every sensor update contributes to the next five-minute point.
      for (size_t metric = 0; metric < HISTORY_METRIC_COUNT; ++metric)
        g_history_accumulator[metric] += values[metric];
      ++g_history_accumulator_count;

      if (now - g_last_history_sample_ms < HISTORY_SAMPLE_MS)
        return;

      for (size_t metric = 0; metric < HISTORY_METRIC_COUNT; ++metric)
      {
        g_history[metric][g_history_head] =
            g_history_accumulator[metric] / g_history_accumulator_count;
        g_history_accumulator[metric] = 0.0f;
      }

      g_history_head = (g_history_head + 1) % HISTORY_POINTS;
      if (g_history_count < HISTORY_POINTS)
        ++g_history_count;
      g_history_accumulator_count = 0;
      g_last_history_sample_ms = now;
    }

    inline void draw_history_header(const char *title, const char *page)
    {
      display.fillScreen(GxEPD_WHITE);
      display.setTextColor(GxEPD_BLACK);
      air_monitor_epaper_layout::print_left(display, 16, 29, &SG_Head18, title);
      char header_meta[20];
      snprintf(header_meta, sizeof(header_meta), "24H  %s", page);
      air_monitor_epaper_layout::print_right(display, display.width() - 16, 27, &SG_Caps13, header_meta);
      display.drawLine(16, 40, display.width() - 16, 40, GxEPD_BLACK);
    }

    struct HistorySeries
    {
      const char *label;
      HistoryMetric metric;
      float current;
      const char *suffix;
      bool one_decimal;
      uint8_t line_style;
      uint8_t line_width = 1;
    };

    inline void draw_styled_history_segment(int x0, int y0, int x1, int y1,
                                            uint8_t style, uint16_t segment,
                                            uint8_t line_width = 1)
    {
      bool draw = style == 0;
      if (style == 1) draw = (segment % 8) < 5;
      if (style == 2) draw = (segment % 4) == 0;
      if (style == 3) draw = (segment % 12) < 5 || (segment % 12) == 8;
      if (draw)
      {
        // Offset across the dominant axis so steep and flat strokes are bold.
        const bool horizontal = std::abs(x1 - x0) >= std::abs(y1 - y0);
        for (uint8_t stroke = 0; stroke < line_width; ++stroke)
        {
          const int offset = static_cast<int>(stroke) - line_width / 2;
          display.drawLine(x0 + (horizontal ? 0 : offset),
                           y0 + (horizontal ? offset : 0),
                           x1 + (horizontal ? 0 : offset),
                           y1 + (horizontal ? offset : 0), GxEPD_BLACK);
        }
      }
    }

    inline void history_bounds(HistoryMetric metric, float &min_value, float &max_value)
    {
      min_value = history_value(metric, 0);
      max_value = min_value;
      for (uint16_t i = 1; i < g_history_count; ++i)
      {
        const float value = history_value(metric, i);
        if (value < min_value) min_value = value;
        if (value > max_value) max_value = value;
      }
      float range = max_value - min_value;
      if (range < 0.1f) range = 1.0f;
      min_value -= range * 0.12f;
      max_value += range * 0.12f;
    }

    inline void history_plot_bounds(HistoryMetric metric, float &min_value, float &max_value)
    {
      history_bounds(metric, min_value, max_value);
      // history_value() already applies the selected temperature unit.
      if (metric != HISTORY_TEMP && min_value < 0.0f) min_value = 0.0f;
      const float raw_step = (max_value - min_value) / 2.0f;
      const float magnitude = std::pow(10.0f, std::floor(std::log10(raw_step)));
      const float fraction = raw_step / magnitude;
      const float step = magnitude * (fraction <= 1.0f ? 1.0f :
                                     fraction <= 2.0f ? 2.0f :
                                     fraction <= 5.0f ? 5.0f : 10.0f);
      min_value = std::floor(min_value / step) * step;
      max_value = std::ceil(max_value / step) * step;
      if (max_value <= min_value) max_value = min_value + step;
    }

    inline void format_history_axis_tick(char *label, size_t label_size,
                                         float value, float tick_step)
    {
      if (!std::isfinite(value))
      {
        snprintf(label, label_size, "--");
        return;
      }
      // Keep nearby ticks distinct, including flat readings near 1000 ug/m3.
      int decimals = tick_step < 0.1f ? 3 : tick_step < 1.0f ? 2 : tick_step < 10.0f ? 1 : 0;
      // A shared range can put the middle tick on a half unit even at large spans.
      if (decimals == 0 && std::fabs(value - std::round(value)) > 0.001f) decimals = 1;
      const float quantum = decimals == 3 ? 0.001f : decimals == 2 ? 0.01f : decimals == 1 ? 0.1f : 1.0f;
      if (std::fabs(value) < 0.5f * quantum) value = 0.0f;
      snprintf(label, label_size, "%.*f", decimals, value);
      if (decimals > 0)
      {
        size_t length = std::strlen(label);
        while (length > 0 && label[length - 1] == '0') label[--length] = '\0';
        if (length > 0 && label[length - 1] == '.') label[length - 1] = '\0';
      }
    }

    inline void draw_history_axis_labels(float min_value, float max_value,
                                         int x, int top, int bottom, bool right_axis)
    {
      for (int tick = 0; tick < 3; ++tick)
      {
        const float value = max_value - (max_value - min_value) * tick / 2.0f;
        const int y = top + 2 + tick * (bottom - top - 4) / 2;
        char label[20];
        format_history_axis_tick(label, sizeof(label), value, (max_value - min_value) / 2.0f);
        if (right_axis)
        {
          air_monitor_epaper_layout::print_left(display, x, y + 3, &SG_Caps10, label);
          display.drawLine(x - 7, y, x - 4, y, GxEPD_BLACK);
        }
        else
        {
          air_monitor_epaper_layout::print_right(display, x, y + 3, &SG_Caps10, label);
          display.drawLine(x + 4, y, x + 7, y, GxEPD_BLACK);
        }
      }
    }

    inline void draw_history_legend_item(int x, int baseline_y,
                                         const HistorySeries &series)
    {
      for (uint8_t i = 0; i < 18; ++i)
      {
        bool ink = series.line_style == 0;
        if (series.line_style == 1) ink = (i % 8) < 5;
        if (series.line_style == 2) ink = (i % 4) == 0;
        if (series.line_style == 3) ink = (i % 12) < 5 || (i % 12) == 8;
        if (ink)
          display.fillRect(x + i, baseline_y - 4 - series.line_width / 2,
                           1, series.line_width, GxEPD_BLACK);
      }

      char text[32];
      if (!std::isfinite(series.current))
        snprintf(text, sizeof(text), "%s --", series.label);
      else
        snprintf(text, sizeof(text), series.one_decimal ? "%s %.1f%s" : "%s %.0f%s",
                 series.label, series.current, series.suffix);
      air_monitor_epaper_layout::print_left(display, x + 25, baseline_y, &SG_Caps13, text);
    }

    inline void draw_combined_history_chart(const HistorySeries *series,
                                            size_t series_count,
                                            bool independent_scales,
                                            const char *left_axis_title,
                                            const char *right_axis_title = nullptr)
    {
      const int legend_columns = series_count > 2 ? 2 : static_cast<int>(series_count);
      const int legend_rows = (series_count + legend_columns - 1) / legend_columns;
      const int legend_width = (display.width() - 32) / legend_columns;
      for (size_t i = 0; i < series_count; ++i)
      {
        const int column = i % legend_columns;
        const int row = i / legend_columns;
        draw_history_legend_item(16 + column * legend_width, 60 + row * 20, series[i]);
      }

      const int left = 54;
      const int right = display.width() - (independent_scales ? 54 : 16);
      const int top = legend_rows == 1 ? 85 : 105;
      const int bottom = 207;
      const int width = right - left;
      const int height = bottom - top;

      air_monitor_epaper_layout::print_left(display, left, top - 8, &SG_Caps10, left_axis_title);
      if (right_axis_title != nullptr)
        air_monitor_epaper_layout::print_right(display, right, top - 8, &SG_Caps10, right_axis_title);

      display.drawRect(left, top, width + 1, height + 1, GxEPD_BLACK);
      for (int row = 1; row < 4; ++row)
      {
        const int y = top + row * height / 4;
        for (int x = left + 1; x < right; x += 12)
          display.drawLine(x, y, x + 5, y, GxEPD_BLACK);
      }
      for (int x = left + width / 4; x < right; x += width / 4)
        for (int y = top + 1; y < bottom; y += 10)
          display.drawLine(x, y, x, y + 4, GxEPD_BLACK);

      air_monitor_epaper_layout::print_left(display, left, 222, &SG_Caps10, "-24H");
      air_monitor_epaper_layout::print_centered(display, left + width / 2, 222, &SG_Caps10, "-12H");
      air_monitor_epaper_layout::print_right(display, right, 222, &SG_Caps10, "NOW");
      air_monitor_epaper_layout::print_centered(display, left + width / 2, 238, &SG_Caps10, "TIME");

      if (g_history_count == 0)
      {
        draw_history_axis_labels(NAN, NAN, left - 7, top, bottom, false);
        if (independent_scales)
          draw_history_axis_labels(NAN, NAN, right + 7, top, bottom, true);
        air_monitor_epaper_layout::print_centered(display, display.width() / 2,
                                                   top + height / 2 + 4,
                                                   &SG_Caps13, "WAITING FOR DATA");
        return;
      }

      float shared_min = 0.0f;
      float shared_max = 0.0f;
      if (!independent_scales)
      {
        history_plot_bounds(series[0].metric, shared_min, shared_max);
        for (size_t s = 1; s < series_count; ++s)
        {
          float series_min, series_max;
          history_plot_bounds(series[s].metric, series_min, series_max);
          if (series_min < shared_min) shared_min = series_min;
          if (series_max > shared_max) shared_max = series_max;
        }
        draw_history_axis_labels(shared_min, shared_max, left - 7, top, bottom, false);
      }

      for (size_t s = 0; s < series_count; ++s)
      {
        float min_value = shared_min;
        float max_value = shared_max;
        if (independent_scales)
        {
          history_plot_bounds(series[s].metric, min_value, max_value);
          draw_history_axis_labels(min_value, max_value, s == 0 ? left - 7 : right + 7,
                                   top, bottom, s != 0);
        }
        const float range = max_value - min_value;
        int previous_x = 0;
        int previous_y = 0;
        for (uint16_t i = 0; i < g_history_count; ++i)
        {
          const float value = history_value(series[s].metric, i);
          const int px = right - static_cast<int>((g_history_count - 1 - i) * width / (HISTORY_POINTS - 1));
          const int py = bottom - 2 - static_cast<int>((value - min_value) * (height - 4) / range);
          if (i > 0)
            draw_styled_history_segment(previous_x, previous_y, px, py,
                                        series[s].line_style, i, series[s].line_width);
          previous_x = px;
          previous_y = py;
        }
        display.fillCircle(previous_x, previous_y, s == 0 ? 2 : 1, GxEPD_BLACK);
      }

      if (g_history_count < 2)
        air_monitor_epaper_layout::print_left(display, left + 7, bottom - 8,
                                               &SG_Caps10, "COLLECTING");
    }

    // --- High-Level Renderers ---
    inline void render_boot(uint8_t frame, bool full)
    {
      if (full)
      {
        render_paged(true, [frame]()
                     {
          display.fillScreen(GxEPD_WHITE);
          draw_boot_content(frame); });
      }
      else
      {
        const int animation_y = g_boot_layout.baseline_y + 20;
        display.setPartialWindow(136, animation_y, 144, 40);
        display.firstPage();
        do
        {
          display.fillRect(136, animation_y, 144, 40, GxEPD_WHITE);
          display.setTextColor(GxEPD_BLACK);
          air_monitor_epaper_layout::print_centered(display, display.width() / 2,
                                                     g_boot_layout.baseline_y + 34,
                                                     &SG_Caps10, "SENSORS STARTING");
          const int start_x = display.width() / 2 - 35;
          const int y = g_boot_layout.baseline_y + 46;
          for (uint8_t i = 0; i < BOOT_SLASH_FRAME_COUNT; ++i)
          {
            const int x = start_x + i * 20;
            if (i == frame)
              display.fillRect(x, y - 2, 11, 4, GxEPD_BLACK);
            else
              display.drawLine(x, y, x + 10, y, GxEPD_BLACK);
          }
          esphome::App.feed_wdt();
        } while (display.nextPage());
      }
    }

    inline void render_normal(bool full)
    {
      render_paged(full, []()
                   {
        air_monitor_epaper_layout::Metrics m = {g_co2, g_temp, g_rh, g_pm1, g_pm25, g_pm4, g_pm10, g_voc, g_nox};
        air_monitor_epaper_layout::render_status_layout(display, m, g_use_f,
                                                  g_date_text.c_str(), g_time_text.c_str(), g_weather,
                                                  g_update_available); });
      g_last_normal_render_ms = millis();
    }

    inline void render_particles(bool full)
    {
      render_paged(full, []()
                   {
        draw_history_header("PARTICLES", "2 / 5");
        const HistorySeries series[] = {
          {"PM1", HISTORY_PM1, g_pm1, "", true, 0, 3},
          {"PM2.5", HISTORY_PM25, g_pm25, "", true, 1, 3},
          {"PM4", HISTORY_PM4, g_pm4, "", true, 2, 3},
          {"PM10", HISTORY_PM10, g_pm10, "", true, 3, 3}
        };
        draw_combined_history_chart(series, 4, false, "\xB5g/m\xB3"); });
      g_last_normal_render_ms = millis();
    }

    inline void render_gases(bool full)
    {
      render_paged(full, []()
                   {
        draw_history_header("GASES", "3 / 5");
        const HistorySeries series[] = {
          {"VOC", HISTORY_VOC, g_voc, "", false, 0, 3},
          {"NOX", HISTORY_NOX, g_nox, "", false, 1, 3}
        };
        draw_combined_history_chart(series, 2, true, "VOC INDEX", "NOX INDEX"); });
      g_last_normal_render_ms = millis();
    }

    inline void render_climate(bool full)
    {
      const float shown_temp = g_use_f ? g_temp * 9.0f / 5.0f + 32.0f : g_temp;
      render_paged(full, [shown_temp]()
                   {
        draw_history_header("CLIMATE", "4 / 5");
        const HistorySeries series[] = {
          {"TEMP", HISTORY_TEMP, shown_temp, g_use_f ? "F" : "C", true, 0, 3},
          {"HUM", HISTORY_RH, g_rh, "%", true, 1, 3}
        };
        draw_combined_history_chart(series, 2, true, g_use_f ? "TEMP \xB0" "F" : "TEMP \xB0" "C", "HUM %"); });
      g_last_normal_render_ms = millis();
    }

    inline bool is_history_mode()
    {
      return g_display_mode == MODE_PARTICLES ||
             g_display_mode == MODE_GASES ||
             g_display_mode == MODE_CLIMATE;
    }

    inline void render_active_data_page(bool full)
    {
      switch (g_display_mode)
      {
      case MODE_PARTICLES:
        render_particles(full);
        break;
      case MODE_GASES:
        render_gases(full);
        break;
      case MODE_CLIMATE:
        render_climate(full);
        break;
      default:
        render_normal(full);
        break;
      }
    }

    inline bool wifi_connected()
    {
      bool connected = false;
#ifdef USE_WIFI
      if (esphome::wifi::global_wifi_component)
        connected = esphome::wifi::global_wifi_component->is_connected();
#endif
      return connected;
    }

    inline std::string wifi_ip_string()
    {
#ifdef USE_WIFI
      if (!esphome::wifi::global_wifi_component)
        return "";
      if (!esphome::wifi::global_wifi_component->is_connected() &&
          !esphome::wifi::global_wifi_component->is_ap_active())
        return "";

      const auto addresses = esphome::wifi::global_wifi_component->get_ip_addresses();
      for (const auto &ip : addresses)
      {
        if (!ip.is_set() || !ip.is_ip4())
          continue;
        char buf[esphome::network::IP_ADDRESS_BUFFER_SIZE];
        ip.str_to(buf);
        return buf;
      }
#endif
      return "";
    }

    inline std::string info_hostname()
    {
      return esphome::App.get_name() + ".local";
    }

    inline std::string info_ip_string()
    {
      return wifi_ip_string();
    }

    inline std::string info_use_address()
    {
#ifdef USE_WIFI
      if (esphome::wifi::global_wifi_component)
      {
        const char *use_address = esphome::wifi::global_wifi_component->get_use_address();
        if (use_address != nullptr && use_address[0] != '\0')
          return use_address;
      }
#endif
      return info_hostname();
    }

    inline std::string info_dashboard_target()
    {
      const std::string ip = info_ip_string();
      if (!ip.empty())
        return "http://" + ip + "/";
      return "http://" + info_use_address() + "/";
    }

    inline void draw_info_header()
    {
      display.fillScreen(GxEPD_WHITE);
      display.setTextColor(GxEPD_BLACK);

      air_monitor_epaper_layout::print_left(display, 16, 28, &SG_Head18, "DEVICE INFORMATION");
      air_monitor_epaper_layout::draw_divider(display, 16, display.width() - 17, 41);
    }

    inline void draw_info_meta_row(const char *host_text, const char *ip_text)
    {
      air_monitor_epaper_layout::print_left(display, 16, 63, &SG_Caps10, "HOST");
      air_monitor_epaper_layout::print_left(display, 16, 84, &SG_Caps10, "IP");
      air_monitor_epaper_layout::print_left(display, 60, 63, &SG_Info12, host_text);
      air_monitor_epaper_layout::print_left(display, 60, 84, &SG_Info12, ip_text);
      air_monitor_epaper_layout::draw_divider(display, 16, display.width() - 17, 94);
    }

    inline void draw_info_cards(const char *left_label, const char *left_target,
                                const char *right_label, const char *right_target)
    {
      static constexpr int qr_box_size = 111; // 29 modules + four-module quiet zone, at 3 px
      static constexpr int qr_y = 120;
      static constexpr int left_qr_x = 49;
      const int right_qr_x = display.width() - 49 - qr_box_size;
      const int left_center_x = left_qr_x + qr_box_size / 2;
      const int right_center_x = right_qr_x + qr_box_size / 2;

      display.drawLine(display.width() / 2, 106, display.width() / 2, 224, GxEPD_BLACK);

      air_monitor_epaper_layout::print_centered(display, left_center_x, 111, &SG_Caps13, left_label);
      air_monitor_epaper_layout::print_centered(display, right_center_x, 111, &SG_Caps13, right_label);

      draw_info_qr_card(left_qr_x, qr_y, left_target);
      draw_info_qr_card(right_qr_x, qr_y, right_target);
    }

    inline void draw_info_qr_card(int x, int y, const char *target)
    {
      draw_info_qr_card(x, y, target, 3, 12);
    }

    inline void draw_info_qr_card(int x, int y, const char *target,
                                  int scale, int padding)
    {
      static constexpr uint8_t QR_VERSION = 3, QR_MAX_VERSION = 6;
      QRCode qr;
      uint8_t data[((4 * QR_MAX_VERSION + 17) * (4 * QR_MAX_VERSION + 17) + 7) / 8];
      bool encoded = false;
      for (uint8_t version = QR_VERSION; version <= QR_MAX_VERSION; ++version) {
        if (qrcode_initText(&qr, data, version, ECC_LOW, target) == 0) { encoded = true; break; }
      }
      const int box_size = padding * 2 + 29 * scale;

      display.fillRect(x, y, box_size, box_size, GxEPD_WHITE);
      if (!encoded) {
        air_monitor_epaper_layout::print_centered(display, x + box_size / 2, y + box_size / 2,
                                                  &SG_Caps10, "QR ERROR");
        return;
      }
      // Keep a clear four-module quiet zone. Longer URLs use a larger QR
      // version with smaller pixels, centered in the same aligned box.
      const int module_scale = std::min(scale, box_size / (qr.size + 8));
      const int margin = (box_size - qr.size * module_scale) / 2;

      for (uint8_t row = 0; row < qr.size; ++row)
      {
        for (uint8_t col = 0; col < qr.size; ++col)
        {
          if (!qrcode_getModule(&qr, col, row))
            continue;
          display.fillRect(x + margin + col * module_scale,
                           y + margin + row * module_scale,
                           module_scale, module_scale, GxEPD_BLACK);
        }
      }
    }

    inline void draw_connected_info_bracket(bool left_side)
    {
      const int max_x = display.width() - 1;
      air_monitor::air_monitor_epaper_layout::Point h_start = {28, 96};
      air_monitor::air_monitor_epaper_layout::Point h_end = {160, 96};
      air_monitor::air_monitor_epaper_layout::Point c_ctrl = {176, 96};
      air_monitor::air_monitor_epaper_layout::Point c_end = {182, 114};
      air_monitor::air_monitor_epaper_layout::Point d_end = {198, 162};

      if (!left_side)
      {
        h_start.x = max_x - h_start.x;
        h_end.x = max_x - h_end.x;
        c_ctrl.x = max_x - c_ctrl.x;
        c_end.x = max_x - c_end.x;
        d_end.x = max_x - d_end.x;
      }

      air_monitor_epaper_layout::draw_stroked_line(display, h_start, h_end, 1);
      air_monitor_epaper_layout::draw_stroked_quadratic(display, h_end, c_ctrl, c_end, 1);
      air_monitor_epaper_layout::draw_stroked_line(display, c_end, d_end, 1);
    }

    inline void render_info_connected()
    {
      const std::string hostname = info_hostname();
      const std::string ip = info_ip_string();
      const std::string host_text = hostname;
      const std::string ip_text = ip.empty() ? std::string("--") : ip;
      const std::string dashboard_target = info_dashboard_target();

      draw_info_header();
      draw_info_meta_row(host_text.c_str(), ip_text.c_str());
      draw_info_cards("INSTRUCTIONS", INFO_INSTRUCTIONS_URL,
                      "DASHBOARD", dashboard_target.c_str());
    }

    inline void render_info_disconnected()
    {
      const std::string setup_ap_name = esphome::App.get_name();
      draw_info_header();
      air_monitor_epaper_layout::print_left(display, 16, 63, &SG_Caps10, "WIFI");
      air_monitor_epaper_layout::print_left(display, 80, 63, &SG_Info12, "Not connected");
      air_monitor_epaper_layout::print_left(display, 16, 84, &SG_Caps10, "SETUP AP");
      air_monitor_epaper_layout::print_left(display, 80, 84, &SG_Info12, setup_ap_name.c_str());
      air_monitor_epaper_layout::draw_divider(display, 16, display.width() - 17, 94);
      air_monitor_epaper_layout::print_centered(display, 104, 111, &SG_Caps13, "INSTRUCTIONS");
      draw_info_qr_card(49, 120, INFO_INSTRUCTIONS_URL);
      display.drawLine(208, 106, 208, 224, GxEPD_BLACK);
      air_monitor_epaper_layout::print_centered(display, 312, 111, &SG_Caps13, "WIFI SETUP");
      air_monitor_epaper_layout::print_left(display, 228, 145, &SG_Info12, "Restart the board.");
      air_monitor_epaper_layout::print_left(display, 228, 166, &SG_Info12, "Join the setup Wi-Fi.");
      air_monitor_epaper_layout::print_left(display, 228, 187, &SG_Info12, "Open 192.168.4.1");
    }

    inline void render_info(bool full)
    {
      const bool connected = wifi_connected();
      render_paged(full, [connected]()
                   {
         if (connected) render_info_connected();
         else render_info_disconnected(); });
      g_last_info_wifi_state = connected ? 1 : 0;
    }

    inline void render_reset(bool full)
    {
      render_paged(full, []()
                   {
        display.fillScreen(GxEPD_WHITE);
        display.setTextColor(GxEPD_BLACK);
        air_monitor_epaper_layout::draw_info_triangle(display, display.width() - 18, 13, 14, 26);

        air_monitor_epaper_layout::print_centered(display, display.width() / 2, 49,
                                              &Inter_ExtraBold_Factory_Reset_Subset20pt7b,
                                              "Factory Reset");
        air_monitor_epaper_layout::draw_divider(display, 155, 260, 68);

        air_monitor_epaper_layout::print_centered(display, display.width() / 2, 120, &Inter_Bold12pt7b, "Hold button (3s) to confirm");
        air_monitor_epaper_layout::print_centered(display, display.width() / 2, 160, &Inter_Bold12pt7b, "Click once to cancel"); });
    }

    inline void redraw(bool full)
    {
      if (!s_inited)
        return;
      switch (g_display_mode)
      {
      case MODE_BOOT:
        render_boot(g_boot_frame, full);
        break;
      case MODE_NORMAL:
        render_normal(full);
        break;
      case MODE_PARTICLES:
        render_particles(full);
        break;
      case MODE_GASES:
        render_gases(full);
        break;
      case MODE_CLIMATE:
        render_climate(full);
        break;
      case MODE_INFO:
        render_info(full);
        break;
      case MODE_RESET:
        render_reset(full);
        break;
      }
    }

    // --- Public API ---
    inline void on_short_press()
    {
      if (g_display_mode == MODE_BOOT)
        return;
      switch (g_display_mode)
      {
      case MODE_NORMAL:
        g_display_mode = MODE_PARTICLES;
        break;
      case MODE_PARTICLES:
        g_display_mode = MODE_GASES;
        break;
      case MODE_GASES:
        g_display_mode = MODE_CLIMATE;
        break;
      case MODE_CLIMATE:
        g_display_mode = MODE_INFO;
        break;
      default:
        g_display_mode = MODE_NORMAL;
        break;
      }
      redraw(true);
    }

    inline bool on_long_press()
    {
      if (g_display_mode == MODE_BOOT)
        return false;
      if (g_display_mode == MODE_INFO)
      {
        if (g_last_info_wifi_state == 0)
          esphome::App.safe_reboot();
        return false;
      }
      if (g_display_mode == MODE_RESET)
        return true;
      g_display_mode = MODE_RESET;
      redraw(true);
      return false;
    }

    inline void tick_and_draw(float co2, float temp, float rh, float pm1, float pm25, float pm4, float pm10, float voc, float nox, bool use_f,
                              const std::string &date_text, const std::string &time_text, int weather,
                              bool update_available = false)
    {
      init_once();
      g_co2 = co2;
      g_temp = temp;
      g_rh = rh;
      g_pm1 = pm1;
      g_pm25 = pm25;
      g_pm4 = pm4;
      g_pm10 = pm10;
      g_voc = voc;
      g_nox = nox;
      g_use_f = use_f;
      g_date_text = date_text;
      g_time_text = time_text;
      g_weather = weather;
      g_update_available = update_available;

      unsigned long now = millis();
      sample_history(now);
      if (g_display_mode == MODE_BOOT)
      {
        if (g_boot_start_ms == 0)
          g_boot_start_ms = now;

        if (all_metrics_ready() || (now - g_boot_start_ms >= BOOT_TIMEOUT_MS))
        {
          g_display_mode = MODE_NORMAL;
          render_normal(true);
          return;
        }

        if (g_boot_full_refreshes < 1)
        {
          render_boot(g_boot_frame, true);
          g_boot_full_refreshes++;
          g_last_boot_frame_ms = now;
          return;
        }

        if (now - g_last_boot_frame_ms >= BOOT_FRAME_MS)
        {
          g_boot_frame = (g_boot_frame + 1) % BOOT_SLASH_FRAME_COUNT;
          render_boot(g_boot_frame, false);
          g_last_boot_frame_ms = now;
        }
        return;
      }

      if ((g_display_mode == MODE_NORMAL || is_history_mode()) &&
          (g_last_normal_render_ms == 0 || now - g_last_normal_render_ms >= NORMAL_REFRESH_MS))
      {
        // Prevent e-paper ghosting by running a full refresh every ~24 hours (17280 * 5s)
        static unsigned int normal_refresh_count = 1;
        bool full_refresh = (normal_refresh_count % 17280 == 0);
        render_active_data_page(full_refresh);
        normal_refresh_count++;
        return;
      }

      if (g_display_mode == MODE_INFO)
      {
        int8_t current_wifi_state = wifi_connected() ? 1 : 0;
        if (current_wifi_state != g_last_info_wifi_state)
          render_info(true);
      }
    }

  } // namespace air_monitor_epaper
} // namespace air_monitor
