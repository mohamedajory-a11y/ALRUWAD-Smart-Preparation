package ly.ruwad.preparation;
import android.app.Activity;
import android.os.Bundle;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebSettings;
public class MainActivity extends Activity {
 private WebView web;
 @Override public void onCreate(Bundle savedInstanceState){super.onCreate(savedInstanceState);web=new WebView(this);web.setWebViewClient(new WebViewClient());web.getSettings().setJavaScriptEnabled(true);web.getSettings().setDomStorageEnabled(true);web.getSettings().setAllowFileAccess(true);setContentView(web);web.loadUrl("file:///android_asset/index.html");}
 @Override public void onBackPressed(){if(web!=null && web.canGoBack())web.goBack();else super.onBackPressed();}
}
