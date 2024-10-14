---
title: "Laravel's most underrated security feature - What actually is a signed url, and how do they work?"
description: 'Signed URLs are an underrated security feature in Laravel. In this post we will explore where to use them, and how they work under the hood'
pubDate: '2024-04-17'
heroImage: './blog-laravel-signed-urls.png'
tags:
  - Laravel
  - PHP
  - Security
---
Laravel comes with many fantastic security features out of the box and also has many 1st party packages that add security functionality to your application. We have Cross Site Scripting (XSS) protection, Cross Site Request Forgery (CSRF) protection, Roles and Permissions via Gates, SQL Injection protection, but also whole authentication scaffolding (Breeze) including 2 factor authorization (Jetstream)

One feature is very much overlooked in my opinion. Laravel comes with the ability to create signed urls. In this article I will not only show how to use signed URLs (Laravel makes this trivial), but also look on how this works under the hood so that you can implement the same functionality in other languages (or your own PHP framework).

## What are signed URLs?

Signed URLs are unguessable URLs you can share with other people without the requirement of being logged in into the system. They are like normal URLs to your app, but have a cryptographically signed hash at the end of the URL.

```bash
# normal url
http://signed-url.test/file/29

# signed url
http://signed-url.test/file/29?signature=78e68c73c03586a5705442e86116c5169c8b64e4720b16766eece296ada49d5a
```

This makes the URLs temper-proof; Change one character in the URL and the hash will not match any longer. AWS S3 uses signed URLs to retrieve private images.

### What can I actually use these for?

The [Laravel Documentation](https://laravel.com/docs/11.x/urls#signed-urls) actually has a fantastic use case for signed URLs: Unsubscribing a user from a newsletter. You get an email, click the unsubscribe button, and you can unsubscribe from the newsletter without logging in or send another confirmation email, because the email address cannot be changed. If you changed the email address the hash would not match any longer.

Another example would be a file sharing application. Upload the file, and get a signed url you can use to share the file with your friends or on the internet without anyone to register an account.

## What are signed URLs not?

They are not one time use URLs, at least not by default. There is not default way to invalidate the signed URL, except for changing the application key, which would invalidate every single signed URL. Do not use signed URLs for security critical endpoints, if you don't have a strategy to invalidate the URLs.

[There was a discussion on Reddit on this earlier this year.](https://www.reddit.com/r/laravel/comments/1blzi84/comment/kw92scd/?utm_source=share&utm_medium=web3x&utm_name=web3xcss&utm_term=1&utm_content=share_button)

## Generating Signed URLs

Generating a signed URL in Laravel is super easy.

```php
<?php
use Illuminate\Support\Facades\URL; // Import the URL facade

class NewsletterController extends Controller
{
	// ...
	public function unsubscribe()
	{
		// ...
		$unsubscription = NewsletterUnsubscriptions::create();
		$signedRoute = URL::signedRoute('newsletter.unsubscribe', ['unsubscription' => $unsubscription]);
		// http://signed-url.test/newsletter/unsubscriptions/29?signature=78e68c73c03586a5705442e86116c5169c8b64e4720b16766eece296ada49d5a
		// ...
	}
}
```

## Invalidating a Signed URL

There is one way to invalidate a signed URL build into Laravel: The ability to add a time limit to a signed URL, making it temporary. When the current timestamp (on the server, of course) is after the timestamp specified in the signed URL, Laravel actually invalidates the URL automatically.

```php
<?php
use Illuminate\Support\Facades\URL; // Import the URL facade

class NewsletterController extends Controller
{
	// ...
	public function unsubscribe()
	{
		// ...
		// To add a timestamp to a signed URL, just use the temporarySignedRoute method instead of signedRoute and add a timestamp
		$unsubscription = NewsletterUnsubscriptions::create();
		$signedRoute = URL::temporarySignedRoute('newsletter.unsubscribe', now()->addMinutes(10), ['unsubscription' => $unsubscription]);
		// http://signed-url.test/file/30?expires=1716185539&signature=fa1fcfa2f47270ef2ef55b20aa5990eacbf6fb11d45984828d7be3f87258cae9
	}
}
```

Notice the expires parameter? Laravel add that automatically when using temporarySignedRoute. How cool is that?

## Actually checking the signed URL

Just adding the signature is of course not enough. At no point we are actually confirming that the hash is a legit one. Again, since Laravel supports signed URL out of the box, confirming the hash is super easy as well. It's just changing one line in your route file `routes/web.php`, by adding the `signed` middleware to your route.

```php
{- Route::get('/newsletter/unsubscriptions/{unsubscription}', [\App\Http\Controllers\NewsletterController::class, 'unsubscribe'])->name('newsletter.unsubscribe'); -}
{+ Route::get('/newsletter/unsubscriptions/{unsubscription}', [\App\Http\Controllers\NewsletterController::class, 'unsubscribe'])->name('newsletter.unsubscribe'){*->middleware('signed')*}; +}
```

It does not get easier than this!

## So how does it work under the hood?

I firmly believe that just knowing that a feature exists is not enough. I want to know how these things work under the hood. Let's try to recreate the functionality in a basic way

### Manually generating a signed URL

Manually generating a signed URL requires leveraging PHP's built-in hash function. If you are trying to port this functionality to another language, look up how to hash a string in your language of choice. For instance, [I know Go does have this built in into the crypto package](https://pkg.go.dev/crypto/sha256#Sum256).

```php
// put the timestamp into a variable so we can reuse it here
$expires = now()->addMinutes(10);
$signedRoute = URL::temporarySignedRoute('newsletter.unsubscribe', $expires, ['unsubscription' => $unsubscription]);

$route = URL::route('newsletter.unsubscribe', ['unsubscription' => $unsubscription, 'expires' => $expires->timestamp]);
$manualRoute = $route . '&signature=' . hash_hmac('sha256', $route, config('app.key'));

dd(
    'Result from $signedRoute:' . $signedRoute,
    'Result from $manualRoute:' . $manualRoute
);

// "Result from $signedRoute: http://signed-url.test/file/32?expires=1716187120&signature=b9aa919a8f4ce54e89e4270dbadc2bcab5e203304aacd1c4c95c9889f101e3f1"
// "Result from $manualRoute: http://signed-url.test/file/32?expires=1716187120&signature=b9aa919a8f4ce54e89e4270dbadc2bcab5e203304aacd1c4c95c9889f101e3f1"
```

How easy was that? Notice how we signed the hash with our `app.key` here. Signing urls with a different app key will result in a different hash

### Manually Validating the Signature

By default the `signed` middleware sends the user to a `403` error page. To manually handle URL validation, you can make use of a nice little request helper.

```php
public function show(Request $request, NewsletterUnsubscriptions $unsubscription)
{
    dd($request->hasValidSignature());
}
```

This helper function will check if the signature has not been tampered with, as well as if it has not yet expired.

Under the hood of the hasValidSignature function there is actually happening a lot:

```php
// get the url without query string
$url = $request->url();

// get all query parameters except signature in [$key => $value] form
$query = $request->except('signature');

// join each array entry to a &key=&value string
$params = [];
foreach ($query as $key => $value) {
    $params[] = $key . '=' . $value;
}

// get the signature
$urlsignature = $request->query('signature', '');

// reconstruct the original url without the signature
$original = $url . '?' . implode('&', $params);

// generate a new signature based on the url without the signature
$signature = hash_hmac('sha256', $original, config('app.key'));

// compare the signature in the url with the new signature
$equals = hash_equals($signature, (string) $request->query('signature', ''));

// handle what happens when the hash is not equal
dump($equals);

// check if the timestamp is expired
$expired = false;
if (isset($query['expires'])) {
    $expireTime = Carbon::createFromTimestamp($query['expires']);
    $expired = now()->gt($expireTime);
}

// handle an expired timestamp
dd($expired);
```

We use hash_equals instead of normal string comparison here, because [it is timing attack secure](https://www.php.net/manual/en/function.hash-equals.php).

#### Why would you manually handling this?

The other day I had a client with a peculiar request. They wanted password reset to handle a completely invalid URL differently from an expired URL. On an invalid URL the program would throw an error, on an expired URL the app would redirect to the send password reminder page.

## Homework

### Making signed URLs actually one time usage

So one question remains: How to actually make a signed URL a one time thing? In the example above we took the example from the Laravel documentation. Imagine you want to handle newsletter unsubscriptions. There are several ways you could go about this.

1. Just add a flag to the NewsletterUnsubscription model; it could be a boolean `is_used`, an integer `used_count` or a timestamp `used_at`. After checking the validity of the signed URL (be it manually, or using Laravel's middleware) just check if the used flag was raised. In case of the integer, you could even restrict file downloads to an arbitrary number.
2. Add a flag to the cache of your choice on NewsletterUnsubscription creation. If the cache has an entry, the request is valid, show the page and delete the cache entry. If the cache does not have an entry, the request is invalid.
3. ... even different solutions, I'm sure you can think of more strategies.
