#import <WebKit/WebKit.h>
#import "injectjs.h" // defines: static const char *kPaleToolsJSBase64 = "...";

// Decode the embedded PaleTools payload (prod blob + loader) once.
static NSString *PTPaleToolsSource(void) {
    static NSString *cached = nil;
    static dispatch_once_t once;
    dispatch_once(&once, ^{
        NSString *b64 = [NSString stringWithUTF8String:kPaleToolsJSBase64];
        NSData *data = [[NSData alloc] initWithBase64EncodedString:b64
                       options:NSDataBase64DecodingIgnoreUnknownCharacters];
        cached = [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
    });
    return cached;
}

%hook WKWebView
- (instancetype)initWithFrame:(CGRect)frame configuration:(WKWebViewConfiguration *)configuration {
    NSString *source = PTPaleToolsSource();
    if (source.length && configuration.userContentController) {
        // Avoid double-injecting if multiple webviews share a controller.
        BOOL already = NO;
        for (WKUserScript *s in configuration.userContentController.userScripts) {
            if ([s.source containsString:@"[paletools-loader]"]) { already = YES; break; }
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
