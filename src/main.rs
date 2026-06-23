use bevy::prelude::*;

fn main() {
    App::new()
        .add_plugins(DefaultPlugins)
        .add_systems(Startup, setup)
        .add_systems(Update, spin_model)
        .run();
}

fn setup(mut commands: Commands, asset_server: Res<AssetServer>) {
    // 加载角色模型
    commands.spawn(SceneBundle {
        scene: asset_server.load("models/demo.gltf#Scene0"),
        transform: Transform::from_xyz(0.0, -1.0, 0.0),
        ..default()
    });

    // 相机
    commands.spawn(Camera3dBundle {
        transform: Transform::from_xyz(0.0, 1.0, 4.0)
            .looking_at(Vec3::new(0.0, 0.5, 0.0), Vec3::Y),
        ..default()
    });

    // 主方向光
    commands.spawn(DirectionalLightBundle {
        directional_light: DirectionalLight {
            illuminance: 5000.0,
            shadows_enabled: true,
            ..default()
        },
        transform: Transform::from_xyz(3.0, 5.0, 3.0)
            .looking_at(Vec3::ZERO, Vec3::Y),
        ..default()
    });

    // 补光（背面）
    commands.spawn(DirectionalLightBundle {
        directional_light: DirectionalLight {
            illuminance: 1000.0,
            ..default()
        },
        transform: Transform::from_xyz(-2.0, 1.0, -3.0)
            .looking_at(Vec3::ZERO, Vec3::Y),
        ..default()
    });

    // 环境光提亮暗部
    commands.insert_resource(AmbientLight {
        color: Color::WHITE,
        brightness: 0.3,
    });
}

fn spin_model(mut query: Query<&mut Transform, With<Handle<Scene>>>) {
    for mut transform in &mut query {
        transform.rotate_y(0.002);
    }
}
