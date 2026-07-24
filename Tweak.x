#import <WebKit/WebKit.h>
#import <UIKit/UIKit.h>
#import <zlib.h>
#import "generated/injectjs.h" // pt_payload_gz[] / pt_payload_gz_len (gzipped JS, generated)

static NSString *const PTExportHandlerName = @"paletoolsExport";

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

// Topmost presented controller, so the share sheet appears above the game UI.
static UIViewController *PTTopViewController(void) {
    UIWindow *window = nil;
    for (UIScene *scene in UIApplication.sharedApplication.connectedScenes) {
        if (![scene isKindOfClass:UIWindowScene.class]) continue;
        for (UIWindow *w in ((UIWindowScene *)scene).windows) {
            if (w.isKeyWindow) { window = w; break; }
        }
        if (window) break;
    }
    if (!window) window = UIApplication.sharedApplication.windows.firstObject;

    UIViewController *vc = window.rootViewController;
    while (vc.presentedViewController) vc = vc.presentedViewController;
    return vc;
}

// Receives the storage dump from export-settings.js, writes it to a temp file
// and hands it to the share sheet ("Save to Files", AirDrop, Mail, ...).
// WKWebView ignores `<a download>` / blob: URLs, so this is the only way out.
@interface PTExportHandler : NSObject <WKScriptMessageHandler>
@end

@implementation PTExportHandler
- (void)userContentController:(WKUserContentController *)controller
      didReceiveScriptMessage:(WKScriptMessage *)message {
    if (![message.body isKindOfClass:NSDictionary.class]) return;
    NSDictionary *body = (NSDictionary *)message.body;
    NSString *json = body[@"json"];
    NSString *name = body[@"filename"];
    if (![json isKindOfClass:NSString.class] || !json.length) return;
    if (![name isKindOfClass:NSString.class] || !name.length) name = @"paletools-storage.json";
    name = name.lastPathComponent; // never let the page escape the temp dir

    NSURL *url = [NSURL fileURLWithPath:
        [NSTemporaryDirectory() stringByAppendingPathComponent:name]];
    NSError *error = nil;
    if (![json writeToURL:url atomically:YES encoding:NSUTF8StringEncoding error:&error]) {
        NSLog(@"[PaleTools] export write failed: %@", error);
        return;
    }
    NSLog(@"[PaleTools] exported storage to %@ (%lu bytes)",
          url.path, (unsigned long)json.length);

    dispatch_async(dispatch_get_main_queue(), ^{
        UIViewController *top = PTTopViewController();
        if (!top) return;
        UIActivityViewController *share =
            [[UIActivityViewController alloc] initWithActivityItems:@[url]
                                             applicationActivities:nil];
        // iPad requires an anchor for the popover or presenting throws.
        share.popoverPresentationController.sourceView = top.view;
        share.popoverPresentationController.sourceRect =
            CGRectMake(CGRectGetMidX(top.view.bounds), CGRectGetMidY(top.view.bounds), 0, 0);
        share.popoverPresentationController.permittedArrowDirections = 0;
        [top presentViewController:share animated:YES completion:nil];
    });
}
@end

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

            // Re-adding an existing name raises, so clear it first.
            [configuration.userContentController
                removeScriptMessageHandlerForName:PTExportHandlerName];
            [configuration.userContentController
                addScriptMessageHandler:[PTExportHandler new]
                                   name:PTExportHandlerName];

            NSLog(@"[PaleTools] injected WKUserScript into WKWebView");
        }
    }
    return %orig;
}
%end
