// heatwatch-fan — C SMC fan helper (Swift SIGTRAPs when run as root on Apple Silicon).
#include <IOKit/IOKitLib.h>
#include <math.h>
#include <stdio.h>
#include <stdarg.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

// Must match Swift SMCKeyData_t layout (80 bytes) — wrong offsets break all SMC I/O.
typedef struct {
    uint32_t key;
    uint8_t vers[6];
    uint8_t pad1[2];
    uint8_t pLimit[16];
    uint32_t dataSize;
    uint32_t dataType;
    uint8_t dataAttributes;
    uint8_t pad2;
    uint16_t padding;
    uint8_t result;
    uint8_t status;
    uint8_t data8;
    uint32_t data32;
    uint8_t bytes[32];
} SMCKeyData;

static io_connect_t g_conn;

static uint32_t fourcc(const char *s) {
    return ((uint32_t)(unsigned char)s[0] << 24) |
           ((uint32_t)(unsigned char)s[1] << 16) |
           ((uint32_t)(unsigned char)s[2] << 8) |
           (uint32_t)(unsigned char)s[3];
}

static void copy_key_info(SMCKeyData *dst, const SMCKeyData *src) {
    dst->dataSize = src->dataSize;
    dst->dataType = src->dataType;
    dst->dataAttributes = src->dataAttributes;
}

static int smc_call(SMCKeyData *in, SMCKeyData *out) {
    size_t outSize = sizeof(SMCKeyData);
    kern_return_t r = IOConnectCallStructMethod(
        g_conn, 2, in, sizeof(SMCKeyData), out, &outSize);
    return r == KERN_SUCCESS ? 0 : -1;
}

static int smc_open(void) {
    if (sizeof(SMCKeyData) != 80) return -1;
    io_service_t svc = IOServiceGetMatchingService(kIOMainPortDefault, IOServiceMatching("AppleSMC"));
    if (!svc) return -1;
    kern_return_t r = IOServiceOpen(svc, mach_task_self(), 0, &g_conn);
    IOObjectRelease(svc);
    return r == KERN_SUCCESS ? 0 : -1;
}

static void smc_close(void) {
    if (g_conn) IOServiceClose(g_conn);
    g_conn = 0;
}

static int smc_read_key(const char *key, SMCKeyData *out) {
    SMCKeyData in = {0};
    in.key = fourcc(key);
    in.data8 = 9;
    SMCKeyData tmp = {0};
    if (smc_call(&in, &tmp) != 0 || tmp.result != 0) return -1;
    uint32_t key_type = tmp.dataType;
    uint32_t key_size = tmp.dataSize;
    copy_key_info(&in, &tmp);
    in.data8 = 5;
    memset(&tmp, 0, sizeof(tmp));
    if (smc_call(&in, &tmp) != 0) return -1;
    tmp.dataType = key_type;
    tmp.dataSize = key_size;
    *out = tmp;
    return 0;
}

static int smc_write_bytes(const char *key, const uint8_t *data, size_t len) {
    SMCKeyData in = {0}, out = {0};
    in.key = fourcc(key);
    in.data8 = 9;
    if (smc_call(&in, &out) != 0 || out.result != 0) return -1;
    copy_key_info(&in, &out);
    in.data8 = 6;
    memset(in.bytes, 0, 32);
    memcpy(in.bytes, data, len > 32 ? 32 : len);
    memset(&out, 0, sizeof(out));
    if (smc_call(&in, &out) != 0 || out.result != 0) return -1;
    return 0;
}

static float parse_fpe2(const uint8_t *bytes) {
    uint16_t raw = ((uint16_t)bytes[0] << 8) | (uint16_t)bytes[1];
    return (float)raw / 4.f;
}

static float parse_float(const SMCKeyData *out) {
    if (out->dataType == 0x66706532) { // fpe2
        return parse_fpe2(out->bytes);
    }
    uint32_t bits = ((uint32_t)out->bytes[0] << 24) | ((uint32_t)out->bytes[1] << 16) |
                    ((uint32_t)out->bytes[2] << 8) | (uint32_t)out->bytes[3];
    float f;
    memcpy(&f, &bits, sizeof(f));
    if (f != f || f < -200.f || f > 50000.f) memcpy(&f, out->bytes, sizeof(float));
    /* M-series: live fan RPM often fpe2-encoded while key type is flt. */
    if (out->dataType == 0x666c7420) {
        float fpe2 = parse_fpe2(out->bytes);
        int ieee_ok = (f > 80.f && f <= 15000.f);
        int fpe2_ok = (fpe2 >= 80.f && fpe2 <= 15000.f);
        if (fpe2_ok && !ieee_ok) return fpe2;
        if (ieee_ok && !fpe2_ok) return f;
        if (ieee_ok && fpe2_ok) return fpe2;
        if (fpe2_ok) return fpe2;
        if (ieee_ok) return f;
    }
    return f;
}

static float read_fan_rpm(const char *key, SMCKeyData *out) {
    float le;
    memcpy(&le, out->bytes, sizeof(le));
    uint32_t bits = ((uint32_t)out->bytes[0] << 24) | ((uint32_t)out->bytes[1] << 16) |
                    ((uint32_t)out->bytes[2] << 8) | (uint32_t)out->bytes[3];
    float be;
    memcpy(&be, &bits, sizeof(be));
    size_t len = strlen(key);
    if (len >= 2 && strcmp(key + len - 2, "Tg") == 0) return be;
    if (len >= 2 && (strcmp(key + len - 2, "Ac") == 0 ||
                     strcmp(key + len - 2, "Mn") == 0 ||
                     strcmp(key + len - 2, "Mx") == 0)) return le;
    return parse_float(out);
}

static float read_flt(const char *key) {
    SMCKeyData out;
    if (smc_read_key(key, &out) != 0) return -1.f;
    return read_fan_rpm(key, &out);
}

static int read_rpm_int(const char *key, int fb) {
    float v = read_flt(key);
    if (v >= 0.f && v <= 15000.f) return (int)v;
    return fb;
}

static int read_u8(const char *key, uint8_t *v) {
    SMCKeyData out;
    if (smc_read_key(key, &out) != 0) return -1;
    *v = out.bytes[0];
    return 0;
}

static int write_u8(const char *key, uint8_t v) { return smc_write_bytes(key, &v, 1); }

static int write_flt(const char *key, float v) {
    /* Big-endian IEEE (some SMC keys). */
    uint32_t bits;
    memcpy(&bits, &v, sizeof(bits));
    uint8_t b[4] = {(uint8_t)(bits >> 24), (uint8_t)(bits >> 16), (uint8_t)(bits >> 8), (uint8_t)bits};
    return smc_write_bytes(key, b, 4);
}

/* Apple Silicon fan targets (F*Tg) expect host-endian float bytes — matches HeatWatch Swift. */
static int write_flt_native(const char *key, float v) {
    uint8_t b[4];
    memcpy(b, &v, 4);
    return smc_write_bytes(key, b, 4);
}

static int read_rpm_limit(const char *key, int fb) {
    return read_rpm_int(key, fb);
}


static int fan_count(void) {
    uint8_t n = 0;
    if (read_u8("FNum", &n) == 0 && n > 0 && n <= 4) return n;
    int count = 0;
    char k[8];
    for (int i = 0; i < 4; i++) {
        snprintf(k, sizeof(k), "F%dAc", i);
        float ac = read_flt(k);
        snprintf(k, sizeof(k), "F%dMn", i);
        float mn = read_flt(k);
        if (ac < 0 && mn < 0) break;
        count = i + 1;
    }
    return count;
}

static void mode_key_for(int fan, char *k, size_t ksz) {
    snprintf(k, ksz, "F%dMd", fan);
    uint8_t v;
    if (read_u8(k, &v) != 0) snprintf(k, ksz, "F%dmd", fan);
}


static int g_quiet = 0;

static void qprintf(const char *fmt, ...) {
    if (g_quiet) return;
    va_list ap;
    va_start(ap, fmt);
    vprintf(fmt, ap);
    va_end(ap);
}

static void cmd_status(void) {
    int n = fan_count();
    char k[8];
    for (int i = 0; i < n; i++) {
        snprintf(k, sizeof(k), "F%dMn", i);
        int smin = read_rpm_limit(k, 1800);
        snprintf(k, sizeof(k), "F%dMx", i);
        int smax = read_rpm_limit(k, 6000);
        if (smax < smin + 200) smax = smin + 200;
        uint8_t md = 0;
        char mk[8];
        mode_key_for(i, mk, sizeof(mk));
        read_u8(mk, &md);
        snprintf(k, sizeof(k), "F%dAc", i);
        int rpm = read_rpm_int(k, 0);
        snprintf(k, sizeof(k), "F%dTg", i);
        int tgt = read_rpm_int(k, 0);
        printf("fan%d actual=%d target=%d min=%d max=%d mode=%u\n", i, rpm, tgt, smin, smax, md);
    }
}

/* M3/M4: thermalmonitord blocks mode writes until Ftst=1 and mode yields. */
static int unlock_manual(void) {
    if (write_u8("Ftst", 1) != 0) return -1;
    usleep(50000);
    write_u8("Ftst", 1);
    return 0;
}

static int read_mode(int fan, uint8_t *md) {
    char mk[8];
    mode_key_for(fan, mk, sizeof(mk));
    return read_u8(mk, md);
}

/* Returns 0 only when mode readback is manual (1). */
static int force_manual_mode(int fan) {
    char mk[8];
    uint8_t md = 0xFF;
    mode_key_for(fan, mk, sizeof(mk));
    if (read_mode(fan, &md) == 0 && md == 1) return 0; /* already manual */
    unlock_manual();
    for (int attempt = 0; attempt < 30; attempt++) { /* ~3s */
        write_u8(mk, 1);
        usleep(100000);
        md = 0xFF;
        if (read_mode(fan, &md) == 0 && md == 1) return 0;
        if ((attempt % 8) == 7) unlock_manual();
    }
    return -1;
}

static int release_system(void) {
    int n = fan_count();
    if (n <= 0) return 0;
    char mk[8];
    write_u8("Ftst", 0);
    usleep(100000);
    for (int i = 0; i < n; i++) {
        mode_key_for(i, mk, sizeof(mk));
        write_u8(mk, 3);
        write_u8(mk, 0);
    }
    write_u8("Ftst", 0);
    usleep(50000);
    write_u8("Ftst", 0);
    return 0;
}

static int write_target(int fan, int tgt) {
    char k[8];
    snprintf(k, sizeof(k), "F%dTg", fan);
    return write_flt_native(k, (float)tgt);
}

static int set_rpm(int rpm) {
    int n = fan_count();
    if (n <= 0) return -1;
    char k[8];
    int ok = 0;

    if (unlock_manual() != 0) {
        fprintf(stderr, "error: Ftst unlock failed\n");
        return -1;
    }
    usleep(200000);

    for (int i = 0; i < n; i++) {
        if (force_manual_mode(i) != 0) {
            if (!g_quiet) fprintf(stderr, "warn: fan%d still not manual after unlock\n", i);
            continue;
        }
        snprintf(k, sizeof(k), "F%dMn", i);
        int lo = read_rpm_limit(k, 1800);
        snprintf(k, sizeof(k), "F%dMx", i);
        int hi = read_rpm_limit(k, 6000);
        if (hi < lo + 200) hi = lo + 200;
        int tgt = rpm;
        if (tgt < lo) tgt = lo;
        if (tgt > hi) tgt = hi;

        for (int t = 0; t < 3; t++) {
            force_manual_mode(i);
            write_target(i, tgt);
            usleep(40000);
        }

        uint8_t md = 0;
        read_mode(i, &md);
        snprintf(k, sizeof(k), "F%dAc", i);
        int ac = read_rpm_int(k, 0);
        snprintf(k, sizeof(k), "F%dTg", i);
        int tg = read_rpm_int(k, 0);
        qprintf("fan%d -> %d rpm (max %d) mode=%u actual=%d tg=%d\n", i, tgt, hi, md, ac, tg);
        if (md == 1) ok++;
        else if (!g_quiet) fprintf(stderr, "warn: fan%d mode=%u (wanted 1)\n", i, md);
    }
    return ok > 0 ? 0 : -1;
}

static int set_all_max(void) {
    int n = fan_count();
    if (n <= 0) return -1;
    char k[8];
    int hi_global = 0;
    for (int i = 0; i < n; i++) {
        snprintf(k, sizeof(k), "F%dMx", i);
        int hi = read_rpm_limit(k, 6000);
        if (hi > hi_global) hi_global = hi;
    }
    if (hi_global < 1000) hi_global = 6000;
    return set_rpm(hi_global + 5000);
}

static int rpm_for_score(int score, int minR, int maxR, int current) {
    double s = score;
    if (s < 0) s = 0;
    if (s > 100) s = 100;
    s /= 100.0;
    double target = (double)minR + ((double)(maxR - minR) * pow(s, 1.4));
    if (fabs(target - (double)current) < 120.0) return current;
    return (int)target;
}

static int cmd_auto(int score) {
    int n = fan_count();
    if (n <= 0) return -1;
    if (score >= 100) return set_all_max();
    char k[8];
    snprintf(k, sizeof(k), "F%dMn", 0);
    int lo = read_rpm_limit(k, 1800);
    snprintf(k, sizeof(k), "F%dMx", 0);
    int hi = read_rpm_limit(k, 6000);
    int cur = 0;
    for (int i = 0; i < n; i++) {
        snprintf(k, sizeof(k), "F%dAc", i);
        int r = (int)read_flt(k);
        if (r > cur) cur = r;
    }
    int rpm = rpm_for_score(score, lo, hi, cur);
    return set_rpm(rpm);
}

static void usage(void) {
    fprintf(stderr,
        "heatwatch-fan [-q] release | set <rpm> | max | auto <score> | status\n");
}

int main(int argc, char **argv) {
    int argi = 1;
    while (argi < argc && argv[argi][0] == '-') {
        if (strcmp(argv[argi], "-q") == 0 || strcmp(argv[argi], "--quiet") == 0) {
            g_quiet = 1;
            argi++;
        } else if (strcmp(argv[argi], "-h") == 0 || strcmp(argv[argi], "--help") == 0) {
            usage();
            return 0;
        } else {
            break;
        }
    }
    if (argi >= argc) { usage(); return 1; }
    const char *cmd = argv[argi];

    if (strcmp(cmd, "status") == 0) {
        if (smc_open() != 0) { fprintf(stderr, "error: SMC open failed\n"); return 1; }
        cmd_status();
        smc_close();
        return 0;
    }

    if (geteuid() != 0) {
        fprintf(stderr, "heatwatch-fan %s must run as root\n", cmd);
        return 1;
    }

    if (smc_open() != 0) { fprintf(stderr, "error: SMC open failed\n"); return 1; }

    int rc = 1;
    if (strcmp(cmd, "release") == 0) {
        rc = release_system() == 0 ? 0 : 1;
        if (rc == 0) qprintf("ok system\n");
        else fprintf(stderr, "error: could not restore system fan control\n");
    } else if (strcmp(cmd, "max") == 0 || strcmp(cmd, "blast") == 0) {
        rc = set_all_max() == 0 ? 0 : 1;
        if (rc == 0) qprintf("ok max (all fans)\n");
        else fprintf(stderr, "error: could not max all fans\n");
    } else if (strcmp(cmd, "set") == 0) {
        if (argi + 1 >= argc) { usage(); smc_close(); return 1; }
        int rpm = atoi(argv[argi + 1]);
        rc = set_rpm(rpm) == 0 ? 0 : 1;
        if (rc == 0) qprintf("ok %d (all fans)\n", rpm);
        else fprintf(stderr, "error: could not set fan RPM (manual mode did not stick)\n");
    } else if (strcmp(cmd, "auto") == 0) {
        if (argi + 1 >= argc) { usage(); smc_close(); return 1; }
        int score = atoi(argv[argi + 1]);
        rc = cmd_auto(score) == 0 ? 0 : 1;
        if (rc == 0) qprintf("ok auto %d\n", score);
        else fprintf(stderr, "error: auto fan adjust failed\n");
    } else {
        usage();
    }

    smc_close();
    return rc;
}
