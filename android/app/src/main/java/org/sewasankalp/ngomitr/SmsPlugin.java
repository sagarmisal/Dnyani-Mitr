package org.sewasankalp.ngomitr;

import android.Manifest;
import android.os.Build;
import android.telephony.SmsManager;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.util.ArrayList;

@CapacitorPlugin(
    name = "Sms",
    permissions = {
        @Permission(strings = { Manifest.permission.SEND_SMS }, alias = SmsPlugin.SMS_ALIAS)
    }
)
public class SmsPlugin extends Plugin {

    static final String SMS_ALIAS = "sms";

    @PluginMethod
    public void checkPermission(PluginCall call) {
        JSObject result = new JSObject();
        result.put("granted", getPermissionState(SMS_ALIAS) == PermissionState.GRANTED);
        result.put("state", getPermissionState(SMS_ALIAS).toString());
        call.resolve(result);
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {
        if (getPermissionState(SMS_ALIAS) == PermissionState.GRANTED) {
            JSObject result = new JSObject();
            result.put("granted", true);
            result.put("state", "granted");
            call.resolve(result);
            return;
        }
        requestPermissionForAlias(SMS_ALIAS, call, "permissionCallback");
    }

    // Note: kept public even though Capacitor's reflection (Plugin.java:139)
    // calls setAccessible(true) and would invoke a private method fine —
    // `public` is the de-facto convention and survives any future ProGuard config.
    @PermissionCallback
    public void permissionCallback(PluginCall call) {
        JSObject result = new JSObject();
        boolean granted = getPermissionState(SMS_ALIAS) == PermissionState.GRANTED;
        result.put("granted", granted);
        result.put("state", getPermissionState(SMS_ALIAS).toString());
        call.resolve(result);
    }

    @PluginMethod
    public void sendSms(PluginCall call) {
        if (getPermissionState(SMS_ALIAS) != PermissionState.GRANTED) {
            call.reject("SMS permission not granted", "PERMISSION_DENIED");
            return;
        }

        String to = call.getString("to");
        String message = call.getString("message");

        if (to == null || to.trim().isEmpty()) {
            call.reject("Missing 'to' phone number", "INVALID_ARGS");
            return;
        }
        if (message == null) {
            call.reject("Missing 'message'", "INVALID_ARGS");
            return;
        }

        try {
            SmsManager sms = getSmsManager();
            if (sms == null) {
                call.reject("SmsManager unavailable", "NO_SMS_SUPPORT");
                return;
            }

            // Long messages get split into multipart automatically.
            ArrayList<String> parts = sms.divideMessage(message);
            if (parts.size() == 1) {
                sms.sendTextMessage(to, null, parts.get(0), null, null);
            } else {
                sms.sendMultipartTextMessage(to, null, parts, null, null);
            }

            JSObject result = new JSObject();
            result.put("sent", true);
            result.put("parts", parts.size());
            result.put("to", to);
            call.resolve(result);
        } catch (SecurityException e) {
            call.reject("SMS permission revoked at send time", "PERMISSION_DENIED", e);
        } catch (IllegalArgumentException e) {
            call.reject("Invalid phone number or message: " + e.getMessage(), "INVALID_ARGS", e);
        } catch (Exception e) {
            call.reject("Send failed: " + e.getMessage(), "SEND_FAILED", e);
        }
    }

    private SmsManager getSmsManager() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            return getContext().getSystemService(SmsManager.class);
        }
        return SmsManager.getDefault();
    }
}
