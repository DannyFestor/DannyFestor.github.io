---
title: 'Laravel Websockets with Soketi'
description: 'Websockets do not have to be hard. Laravel makes this very easy with the battle tested Soketi'
pubDate: '2024-03-07'
heroImage: './blog-laravel-soketi.png'
tags:
  - Laravel
  - PHP
  - Websockets
---
Everyone knows these pesky notification bell icons, which tell you in real-time whenever an event is triggered that is meant to... well... notify you.

There are many different ways to implement such a system.

1. Javascript pulling via `setInterval`
2. (Laravel Only) Livewire pulling via wire:poll
3. Server Sent Events
4. Websockets
5. Probably more?

With [Laravel Reverb](https://reverb.laravel.com/) on the radar, releasing on March 12 2024, (as in 4 days, at the time of this article), I wanted to explore how to actually use Websockets; My projects so far have never needed them.

Up until now, [Laravel recommends](https://laravel.com/docs/10.x/broadcasting) [Pusher](https://pusher.com/), [Ably](https://ably.com/), or the self hosted Pusher alternative [Soketi](https://soketi.app/) in the official documentation. Soketi on the other hand has Laravel baked into their documentation as well. So I did the only sane thing, and explored how to use Websockets with Soketi. I expect I can easily migrate to Reverb, once released.

In this article I will omit setting up the project, the models, and views. You can find the source code for this article in my [Github repo](https://github.com/DannyFestor/-Youtube--Notification-Laravel-Soketi/). Follow the commit history to see changes to the various files. I used Laravel Breeze with the Alpine.js template to get Alpine and Tailwind.css installed and set up for me.

### Updating Laravel Sail

Since Soketi is a self hosted solution, you will have to install it somewhere. The easiest way is by using Docker, so I went with Laravel Sail for this tutorial. Laravel Sail is not meant for production, but it is good enough for Localhost development and testing.

#### Add Soketi to Docker

First, you need to add the Soketi image to your docker-compose-file. Obviously skip this step when not using docker. As per [their documentation](https://docs.soketi.app/getting-started/installation/laravel-sail-docker)

```yaml
# docker-compose.yml
services:
	# ...
	soketi:
	    image: 'quay.io/soketi/soketi:latest-16-alpine'
	    environment:
	        SOKETI_DEBUG: '1'
	        SOKETI_METRICS_SERVER_PORT: '9601'
	    ports:
	        - '${SOKETI_PORT:-6001}:6001'
	        - '${SOKETI_METRICS_SERVER_PORT:-9601}:9601'
	    networks:
	        - sail
networks:
# ...
```

You also need to update your environment file. Soketi uses the Pusher protocol, so you need to update relevant Pusher parts

```.env
BROADCAST_DRIVER=pusher # was log

# As set in soketi
PUSHER_APP_ID=app-id
PUSHER_APP_KEY=app-key
PUSHER_APP_SECRET=app-secret
# Host is only soketi in docker. If you installed soketi locally, use 127.0.0.1, or the IP of your server
PUSHER_HOST=soketi
PUSHER_PORT=6001
PUSHER_SCHEME=http

# Browser does not run in docker, so using the value set in PUSHER_HOST won't work
VITE_PUSHER_HOST="127.0.0.1" # was "${PUSHER_HOST}"
```

### Installing the needed packages

#### PHP side

You will have to install the Pusher Channels SDK for Laravel to be able to use the pusher driver

```bash
composer require pusher/pusher-php-server
```

After installing the driver, you need to tweak the configuration to enable broadcasting by uncommenting the BroadcastServiceProvider in `config/app.php`

```php
// config/app.php
// ...
'providers' => ServiceProvider::defaultProviders()->merge([
	// ...
	App\Providers\BroadcastServiceProvider::class, // Enable the Service Provider, was commented out
	// ...
```

#### Frontend (Javascript) Side

You also need the Javascript for you client side code

```bash
npm install --save-dev laravel-echo pusher-js
```

After installing the packages you also have to uncomment the broadcasting related code in `resources/js/bootstrap.js`. Laravel makes it really easy, the code is already there!

```javascript
import Echo from 'laravel-echo';
import Pusher from 'pusher-js';
window.Pusher = Pusher;

window.Echo = new Echo({
    broadcaster: 'pusher',
    key: import.meta.env.VITE_PUSHER_APP_KEY,
    cluster: import.meta.env.VITE_PUSHER_APP_CLUSTER || 'mt1',
    wsHost: import.meta.env.VITE_PUSHER_HOST ? import.meta.env.VITE_PUSHER_HOST : `ws-${import.meta.env.VITE_PUSHER_APP_CLUSTER}.pusher.com`,
    wsPort: import.meta.env.VITE_PUSHER_PORT ?? 80,
    wssPort: import.meta.env.VITE_PUSHER_PORT ?? 443,
    // forceTLS: (import.meta.env.VITE_PUSHER_SCHEME ?? 'https') === 'https',
    forceTLS: false, // I deactivated TLS for local testing
    enabledTransports: ['ws', 'wss'],
    encrypted: true, // Soketi documentation adds this line
    disableStats: true, // as well as this line
});
```

### Broadcasting an event to your users

Broadcasting channels for Websockets live in their own routing file. You are probably used to adding routes to `routes/web.php` or `routes/api.php` and have wondered what the other files were used for. Well, it's time to actually activate `route/channels.php` and add our Websocket Channel! The channel will actually be a private channel, which is scoped to your current user. You can actually add authorization to channels this way!

```php
// routes/channels.php
// The channel always receives the current user, as well as optional arguments. We will connect to notifications.[user_id], which the callback receives as an argument as well
Broadcast::channel('notifications.{userId}', function (User $user, int $userId) {
    return $userId === $user->id; // users can only connect to this channel if true is returned
});
```

In Laravel, information is broadcasted over events, so let us create one.

```bash
php artisan make:event UserNotificationEvent
```

The event will receive a user id, because we scoped the channel to a user in the snippet above, as well as a notification (or whatever data you want to sent).

```php
// app/Events/UserNotificationEvent.php

// do not forget to implement the `Illuminate\Contracts\Broadcasting\ShouldBroadcast` interface, otherwise your event will not be broadcasted to your websocket server
class UserNotificationEvent implements ShouldBroadcast
{
	use Dispatchable, InteractsWithSockets, SerializesModels;

	// receive the data needed for the event. all public properties of the class will be sent on the event
	public function __construct(public int $userId, public Notification $notification)
	{}

	public function broadcastOn(): Channel // update return type from array to Channel
	{
		// broadcast over a private channel to the user!
	    return new PrivateChannel('notifications.' . $this->userId);
	}
}
```

For test purposed I also added a console command to quickly create notifications. This command will also dispatch the event. Usually, you would to everything in the command in your admin panel, but for a small test, a console command has to be sufficient.

```bash
php artisan make:command MakeNotificationCommand
```

```php
class MakeNotificationCommand extends Command
{
	// run with php artisan make:notification, which accepts a number
    protected $signature = 'make:notification {num=1}';

    public function handle()
    {
	    // always prevent shenanigans by your users, even in a test application. I restricted input to 1-100 notifications...
        $num = min(100, max((int)$this->argument('num'), 1));

		// get all users
		// typically, you would select users in your admin panel
        $userIds = User::pluck('id')->all();

        // generate notifications. I'm using a factory here to create random data, but usually you would receive title, content etc through your admin panel
        $notifications = Notification::factory($num)->create();

        $notifications->each(function (Notification $notification) use ($userIds) {
            foreach(array_chunk($userIds, 100) as $chunk) {
		        // add an entry into my notification_user pivot table for each user
                $insert = array_map(function ($userId) use ($notification) {
                    return [
                        'notification_id' => $notification->id,
                        'user_id' => $userId,
                    ];
                }, $chunk);
                NotificationUser::insert($insert);

                foreach($chunk as $userId) {
	                // finally, dispatch the event to every user, passing the notification information
                    UserNotificationEvent::dispatch($userId, $notification);
                }
            }
        });
    }
}
```

If everything went correctly (did you remember to implement the ShouldBroadcast interface? I was trying to figure that one out the longest time 😅)

### Receiving events on the client side

The sending is good and well, but we want to actually see the notifications on the client side as well. I have the views for the notification bell, the unread count, and a notification list all ready. They are available in the git repository if you need inspiration. To receive notifications, you just have to connect to your channel route, and then handle the event!

First, let us get all existing notifications, and pass them to the user. Usually you would do this in a controller, or even a view service provider (since you probably want to show the notification bell on every page), but the `routes/web.php` file will do just fine for this demo

```php
// routes/web.php
Route::get('/dashboard', function () {
    $user = Auth::user();

	// get all new notifications for the current user which (as in, the seen_at column on the notification_user pivot table is null)
    $notifications = $user->notifications()->whereNull('seen_at')->get();

    return view('dashboard', [
        'user' => $user,
        'notifications' => $notifications,
    ]);
})->middleware(['auth', 'verified'])->name('dashboard');

Route::post('/notifications', function (Request $request) {
	// mark all notifications as seen
    \App\Models\NotificationUser::query()
        ->where('user_id', $request->user()->id)
        ->update(['seen_at' => now()]);

    return 'ok';
})->middleware(['auth'])->name('notifications');
```

```php
// resources/views/dashboard.blade.php
// add the notification component, if you have created one, and pass the data
<x-notification :user="$user" :notifications="$notifications" />
```

```html
<!-- resources/views/components/notification.blade.php -->
@props(['user', 'notifications', 'eventName'])

<div x-data="notification">
    <div @click="markRead" class="relative w-6 h-6">
        <x-bell />
        <x-count />
    </div>
    <x-notification-dropdown />
</div>

@push('scripts')
<script>
    document.addEventListener('alpine:init', () => {
        Alpine.data('notification', () => ({
	        // this object will hold all notifications received at page load
            notifications: @json($notifications),

			// a computed property to get the current notification count
            get count() {
                return this.notifications.length;
            },


			// on click of the bell, make a post request to mark all notifications as read. you probably want a better implementation, because you probably want the notifications to show in a popup. I leave the implementation to you
			async markRead() {
			    const { data } = await axios.post('{{ route('notifications') }}');

			    if (data !== undefined && data === 'ok') {
			        this.notifications = [];
			    }
			},

			// this is where we connect to the websocket. Do this on your mounted hook, be it document.addEvent('DOMContentLoaded') in vanialla JS, onMounted in Vue3, or useEffect() in React...
            init() {
		        // connect to our socket. notice that we pass the user id here, just as we expected in routes/channels.php
                Echo.private('notifications.{{ $user->id }}')
		            // the event name we are listening to must exactly match the short/unquolified class name of our event (so, without namespace or the ::class suffix)
                    .listen('UserNotificationEvent', (e) => {
                        if (e.notification !== undefined) {
	                        // if the event has a notification property, push the notification on the notifications object
	                        this.notifications.push(e.notification);
                        }
                    });
            },
        }));
    });
</script>
@endpush
```

My demo implementation is just an ordered list of all notifications. You probably want to pop it up on click, or something similar.

### Conclusion

Laravel makes broadcasting to webcasts as well as receiving the events really easy. Most of the functionality comes out of the box and only a few files have to be adjusted to get started.

#### Bonus: Possible improvements as homework

- The frontend part is really bare bones. Show it some love (and update us how you did it!)
- Show a notification bell throughout your notification. Try adding a [View Composer](https://laravel.com/docs/10.x/views#sharing-data-with-all-views) to accomplish this
- Try playing with public and presence channels as well. Laravels Broadcasting documentation explains what these are
- Maybe build a small chat app that allows guest users to communicate

#### Bonus 2: Getting really cheeky using Reflection

Since we have to pass the short class name to the event, it might make sense to actually let PHP handle the event name. This way you can rename the event (using your IDE/language servers rename function (Intelephense etc), to automatically update references), without digging into the Javascript side again

```php
// routes/web.php
Route::get('/dashboard', function () {
    $user = Auth::user();
    $notifications = $user->notifications()->whereNull('seen_at')->get();
    $eventName = (new \ReflectionClass(\App\Events\UserNotificationEvent::class))->getShortName(); // get the short class name. This will automatically update, should you rename the event via IDE or language server

    return view('dashboard', [
        'user' => $user,
        'notifications' => $notifications,
        'eventName' => $eventName, // pass the eventName to your view. Don't forget to update the views to use the variable, instead of hardcoding the event name3
    ]);
})->middleware(['auth', 'verified'])->name('dashboard');
```

### References

1. [Laravel](https://laravel.com), [Laravel Breeze](https://laravel.com/docs/10.x/starter-kits), [Laravel Reverb](https://reverb.laravel.com/), [Laravel Echo](https://laravel.com/docs/10.x/broadcasting#client-side-installation)
2. [Soketi](https://soketi.app/)
3. [Pusher](https://pusher.com/)
4. [Heroicons](https://heroicons.com/)
5. [Alpine.js](https://alpinejs.dev/)
6. [tailwindcss](https://tailwindcss.com/)
7. [Github Repository](https://github.com/DannyFestor/-Youtube--Notification-Laravel-Soketi)
