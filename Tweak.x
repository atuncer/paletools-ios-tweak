#import <WebKit/WebKit.h>
#import <zlib.h>
#import "generated/injectjs.h" // pt_payload_gz[] / pt_payload_gz_len (gzipped JS, generated)

static NSData *PTGunzip(const unsigned char *src, unsigned long len) {
    z_stream s;
    memset(&s, 0, sizeof(s));
    if (inflateInit2(&s, 15 + 32) != Z_OK) return nil; // +32: auto-detect gzip header
    s.next_in = (Bytef *)src;
    s.avail_in = (uInt)len;

    NSMutableData *out = [NSMutableData data];
    unsigned char buf[65536];
    int ret;
    do {
        s.next_out = buf;
        s.avail_out = sizeof(buf);
        ret = inflate(&s, Z_NO_FLUSH);
        if (ret != Z_OK && ret != Z_STREAM_END) { inflateEnd(&s); return nil; }
        [out appendBytes:buf length:sizeof(buf) - s.avail_out];
    } while (ret != Z_STREAM_END);

    inflateEnd(&s);
    return out;
}

static NSString *PTPaleToolsSource(void) {
    static NSString *cached = nil;
    static dispatch_once_t once;
    dispatch_once(&once, ^{
        NSData *js = PTGunzip(pt_payload_gz, pt_payload_gz_len);
        if (js) cached = [[NSString alloc] initWithData:js encoding:NSUTF8StringEncoding];
    });
    return cached;
}

%hook WKWebView
- (instancetype)initWithFrame:(CGRect)frame configuration:(WKWebViewConfiguration *)configuration {
    NSString *source = PTPaleToolsSource();
    if (source.length && configuration.userContentController) {
        BOOL already = NO;
        for (WKUserScript *s in configuration.userContentController.userScripts) {
            if ([s.source containsString:@"__PALETOOLS_INJECTED__"]) { already = YES; break; }
        }
        if (!already) {
            WKUserScript *script =
                [[WKUserScript alloc] initWithSource:source
                                       injectionTime:WKUserScriptInjectionTimeAtDocumentEnd
                                    forMainFrameOnly:NO];
            [configuration.userContentController addUserScript:script];
            NSLog(@"[PaleTools] injected WKUserScript into WKWebView");
        }
    }
    return %orig;
}
%end
